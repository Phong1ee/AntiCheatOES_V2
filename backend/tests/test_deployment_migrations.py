import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.engine import URL

SPEC = importlib.util.spec_from_file_location("deployment_migrations", Path(__file__).resolve().parents[1] / "scripts/migrate_deployment.py")
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


def environment():
    return {"APP_ENV": "production", "DB_HOST": "mysql.railway.internal", "DB_PORT": "3306",
            "DB_NAME": "railway", "DB_USER": "app", "DB_PASSWORD": "test@:%/password"}


@pytest.mark.parametrize("key", ["APP_ENV", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"])
def test_missing_deployment_variable_fails_without_exposing_credentials(key):
    env = environment()
    env.pop(key)
    with pytest.raises(runner.MigrationConfigurationError) as error:
        runner.validate_environment(env)
    assert env.get("DB_PASSWORD", "never-log-this") not in str(error.value)


@pytest.mark.parametrize("port", ["0", "65536", "abc", "-1"])
def test_invalid_port(port):
    env = environment()
    env["DB_PORT"] = port
    with pytest.raises(runner.MigrationConfigurationError, match="DB_PORT"):
        runner.validate_environment(env)


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_valid_deployment_configuration(app_env):
    env = environment()
    env["APP_ENV"] = app_env
    runner.validate_environment(env)


def setup_migration(monkeypatch, revisions=("old", "head"), acquired=1):
    connection = MagicMock()
    connection.execute.return_value.scalar.return_value = acquired
    context = MagicMock()
    context.get_current_heads.side_effect = [(revision,) for revision in revisions]
    monkeypatch.setattr(runner.MigrationContext, "configure", lambda _: context)
    upgrade = MagicMock()
    monkeypatch.setattr(runner.command, "upgrade", upgrade)
    return connection, Config(), upgrade


def test_upgrade_uses_locked_connection_and_releases_lock(monkeypatch):
    connection, config, upgrade = setup_migration(monkeypatch)
    def check_connection(actual_config, revision):
        assert actual_config.attributes["connection"] is connection
        assert revision == "head"
    upgrade.side_effect = check_connection
    runner.migrate(connection, config, "head", "railway")
    upgrade.assert_called_once()
    sql = [str(call.args[0]) for call in connection.execute.call_args_list]
    assert "GET_LOCK" in sql[0] and "RELEASE_LOCK" in sql[-1]
    assert "connection" not in config.attributes


def test_lock_timeout_does_not_upgrade(monkeypatch):
    connection, config, upgrade = setup_migration(monkeypatch, acquired=0)
    with pytest.raises(runner.MigrationConfigurationError, match="lock"):
        runner.migrate(connection, config, "head", "railway")
    upgrade.assert_not_called()
    assert connection.execute.call_count == 1


def test_upgrade_failure_releases_lock(monkeypatch):
    connection, config, upgrade = setup_migration(monkeypatch)
    upgrade.side_effect = RuntimeError("migration failed")
    with pytest.raises(RuntimeError, match="migration failed"):
        runner.migrate(connection, config, "head", "railway")
    assert "RELEASE_LOCK" in str(connection.execute.call_args.args[0])
    assert "connection" not in config.attributes


def test_post_upgrade_revision_must_match(monkeypatch):
    connection, config, _ = setup_migration(monkeypatch, revisions=("old", "old"))
    with pytest.raises(runner.MigrationConfigurationError, match="reaching"):
        runner.migrate(connection, config, "head", "railway")
    assert "RELEASE_LOCK" in str(connection.execute.call_args.args[0])


@pytest.mark.parametrize("revision,success", [("head", True), ("old", False)])
def test_check_is_read_only(monkeypatch, revision, success):
    connection, config, upgrade = setup_migration(monkeypatch, revisions=(revision,))
    if success:
        runner.migrate(connection, config, "head", "railway", check_only=True)
    else:
        with pytest.raises(runner.MigrationConfigurationError):
            runner.migrate(connection, config, "head", "railway", check_only=True)
    upgrade.assert_not_called()
    connection.execute.assert_not_called()


def test_paths_resolve_outside_backend(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    config = Config(str(runner.BACKEND / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    assert len(script.get_heads()) == 1
    assert Path(script.dir).resolve() == runner.BACKEND / "alembic"
    assert Path(config.get_main_option("prepend_sys_path")).resolve() == runner.BACKEND


def test_encoded_password_survives_alembic_interpolation():
    url = URL.create("mysql+pymysql", username="app", password=environment()["DB_PASSWORD"], host="mysql.railway.internal", database="railway")
    config = Config()
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%"))
    from sqlalchemy.engine import make_url
    assert make_url(config.get_main_option("sqlalchemy.url")).password == environment()["DB_PASSWORD"]


def test_cli_failure_does_not_log_driver_secrets(monkeypatch, capsys):
    monkeypatch.setattr(runner.sys, "argv", ["migrate_deployment.py"])
    def fail(_):
        raise RuntimeError("secret-value-from-driver")
    monkeypatch.setattr(runner, "run", fail)
    assert runner.main() == 1
    output = capsys.readouterr().err
    assert "RuntimeError" in output
    assert "secret-value-from-driver" not in output


def test_missing_runtime_variables_never_connect(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DB_HOST", raising=False)
    engine = MagicMock()
    monkeypatch.setattr(runner, "create_engine", engine)
    with pytest.raises(runner.MigrationConfigurationError, match="DB_HOST"):
        runner.run()
    engine.assert_not_called()


def test_multiple_repository_heads_never_connect(monkeypatch):
    from types import SimpleNamespace
    for key, value in environment().items():
        monkeypatch.setenv(key, value)
    monkeypatch.setitem(runner.sys.modules, "database", SimpleNamespace(URL_DATABASE=URL.create("mysql+pymysql")))
    monkeypatch.setattr(runner.ScriptDirectory, "from_config", lambda _: SimpleNamespace(get_heads=lambda: ["a", "b"]))
    engine = MagicMock()
    monkeypatch.setattr(runner, "create_engine", engine)
    with pytest.raises(runner.MigrationConfigurationError, match="exactly one"):
        runner.run()
    engine.assert_not_called()


def test_applied_multimedia_revision_and_backfill_dependency_are_available():
    config = Config(str(runner.BACKEND / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    revision = script.get_revision("8a21c7e5b940")
    assert revision.down_revision == "f2a7c9e4b106"
    assert script.get_heads() == [revision.revision]
    from src.service.rich_content_service import sanitize_rich
    html, plain = sanitize_rich('<p>Hello <strong>world</strong><script>alert(1)</script></p>')
    assert html == '<p>Hello <strong>world</strong></p>'
    assert plain == 'Hello world'
