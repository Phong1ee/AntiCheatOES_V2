"""Regenerate create_table_v6.sql from the SQLAlchemy models.

The models in backend/src/a_db_config/__init__.py are the source of truth for
this project's schema; the older hand-written scripts in this folder drifted
away from them (missing tables, missing columns, and foreign keys pointing at
user.id instead of user.school_id). Regenerate instead of hand-editing:

    cd backend && python ../database/Create/generate_schema.py
"""
import io
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from sqlalchemy.dialects import mysql  # noqa: E402
from sqlalchemy.schema import CreateTable  # noqa: E402

from src.a_db_config import Base  # noqa: E402

OUTPUT = HERE / "create_table_v6.sql"

HEADER = """\
-- =========================================================================
-- GENERATED FILE - do not edit by hand.
--
-- Source of truth: backend/src/a_db_config/__init__.py (SQLAlchemy models).
-- Regenerate with:  cd backend && python ../database/Create/generate_schema.py
--
-- Note: every foreign key to a user references user.school_id (VARCHAR(30)),
-- not user.id. The older create_table_v*.sql scripts in this folder predate
-- that change and cannot build a working database.
-- =========================================================================
"""


def apply_on_update(statement: str, table) -> str:
    """SQLAlchemy treats server_onupdate as informational and omits it from DDL."""
    for column in table.columns:
        if column.server_onupdate is None:
            continue
        pattern = rf"(^\s*`?{re.escape(column.name)}`?\s+DATETIME[^,\n]*?)(,?)$"
        statement = re.sub(
            pattern,
            lambda match: f"{match.group(1)} ON UPDATE CURRENT_TIMESTAMP{match.group(2)}",
            statement,
            flags=re.M,
        )
    return statement


def main() -> None:
    dialect = mysql.dialect()
    tables = Base.metadata.sorted_tables

    lines = [HEADER, "SET FOREIGN_KEY_CHECKS = 0;", ""]
    lines += [f"DROP TABLE IF EXISTS `{table.name}`;" for table in reversed(tables)]
    lines += ["", "SET FOREIGN_KEY_CHECKS = 1;", ""]

    for table in tables:
        statement = str(CreateTable(table).compile(dialect=dialect)).strip()
        statement = "\n".join(line.rstrip() for line in statement.splitlines())
        lines.append(apply_on_update(statement, table) + ";")
        lines.append("")

    OUTPUT.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUTPUT.name}: {len(tables)} tables")


if __name__ == "__main__":
    main()
