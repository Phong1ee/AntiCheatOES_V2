"""API-only Railway pre-deploy migration; credentials come from service variables."""
import argparse
import hashlib
import os
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

BACKEND = Path(__file__).resolve().parents[1]


class MigrationConfigurationError(RuntimeError):
    """Safe, credential-free errors that can be displayed in deployment logs."""


def validate_environment(environ):
    if environ.get("APP_ENV", "").strip().lower() not in {"staging", "production"}:
        raise MigrationConfigurationError("Set APP_ENV to staging or production for deployment migration.")
    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")
    missing = [key for key in required if not environ.get(key, "").strip()]
    if missing:
        raise MigrationConfigurationError("Missing deployment variables: " + ", ".join(missing))
    try:
        port = int(environ["DB_PORT"])
    except ValueError:
        raise MigrationConfigurationError("DB_PORT must be an integer between 1 and 65535.") from None
    if not 1 <= port <= 65535:
        raise MigrationConfigurationError("DB_PORT must be an integer between 1 and 65535.")


def migrate(connection, config, target, database_name, check_only=False):
    """Serialize upgrades on the same MySQL session; DDL is not transactional."""
    def current():
        return tuple(MigrationContext.configure(connection).get_current_heads())

    if check_only:
        revisions = current()
        print("Database revision: " + (", ".join(revisions) or "unversioned"))
        print("Repository head: " + target)
        if revisions != (target,):
            raise MigrationConfigurationError("Database is not at repository head; run the pre-deploy upgrade.")
        return

    lock_name = "oes:alembic:" + hashlib.sha256(database_name.encode()).hexdigest()[:40]
    acquired = connection.execute(text("SELECT GET_LOCK(:name, :timeout)"),
                                  {"name": lock_name, "timeout": 60}).scalar()
    # End SQLAlchemy's implicit transaction before Alembic manages its own.
    # GET_LOCK is session-scoped and survives COMMIT.
    connection.commit()
    if acquired != 1:
        raise MigrationConfigurationError("Could not acquire MySQL migration lock within 60 seconds.")
    try:
        revisions = current()
        connection.commit()
        print("Database revision before upgrade: " + (", ".join(revisions) or "unversioned"))
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        connection.commit()
        if current() != (target,):
            raise MigrationConfigurationError("Upgrade completed without reaching repository head.")
        connection.commit()
        print("Database verified at revision: " + target)
    finally:
        config.attributes.pop("connection", None)
        connection.rollback()
        connection.execute(text("SELECT RELEASE_LOCK(:name)"), {"name": lock_name})
        connection.commit()


def run(check_only=False):
    # Validate BEFORE importing database: deployment must not silently use the
    # developer .env, localhost defaults, or an incomplete service configuration.
    validate_environment(os.environ)
    sys.path.insert(0, str(BACKEND))
    from database import URL_DATABASE

    config = Config(str(BACKEND / "alembic.ini"))
    heads = ScriptDirectory.from_config(config).get_heads()
    if len(heads) != 1:
        raise MigrationConfigurationError("Repository must contain exactly one Alembic head.")
    engine = create_engine(URL_DATABASE, poolclass=NullPool, echo=False,
                           connect_args={"connect_timeout": 30})
    try:
        with engine.connect() as connection:
            migrate(connection, config, heads[0], URL_DATABASE.database, check_only)
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Read-only revision check; never apply migrations.")
    args = parser.parse_args()
    try:
        run(args.check)
    except MigrationConfigurationError as exc:
        print("Migration failed: " + str(exc), file=sys.stderr)
        return 1
    except Exception as exc:
        # Driver/SQL exceptions can contain credentials, SQL, or existing row
        # contents. Do not dump them into hosted deployment logs.
        print("Migration failed (" + type(exc).__name__ + "). Check DB connectivity, grants and migration revision. MySQL DDL may have partially applied; inspect before retrying.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
