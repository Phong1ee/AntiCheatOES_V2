"""migrate user references to school id

Revision ID: a391dec649ff
Revises: 73a66610d3da
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a391dec649ff"
down_revision: Union[str, Sequence[str], None] = "73a66610d3da"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, column, nullable). These are the only user references being changed.
REFERENCES = (
    ("attempt", "student_id", True),
    ("student_class", "student_id", False),
    ("class", "teacher_id", False),
    ("teacher_subject", "teacher_id", False),
    ("teacher_subject", "assigned_by", True),
    ("question", "created_by", True),
    ("question_revision", "edited_by", True),
    ("question_revision", "approved_by", True),
    ("user", "locked_by", True),
    ("user", "deleted_by", True),
)


def _preflight(connection: sa.Connection, source_column: str, target_column: str) -> None:
    invalid_school_ids = connection.execute(sa.text(
        "SELECT COUNT(*) FROM `user` WHERE school_id IS NULL OR TRIM(school_id) = ''"
    )).scalar_one()
    duplicate_school_ids = connection.execute(sa.text(
        "SELECT COUNT(*) FROM (SELECT school_id FROM `user` GROUP BY school_id HAVING COUNT(*) > 1) duplicates"
    )).scalar_one()
    if invalid_school_ids or duplicate_school_ids:
        raise RuntimeError("Cannot migrate user references: user.school_id contains blank or duplicate values")

    for table, column, _nullable in REFERENCES:
        unresolved = connection.execute(sa.text(
            f"SELECT COUNT(*) FROM `{table}` t LEFT JOIN `user` u ON u.`{source_column}` = t.`{column}` "
            f"WHERE t.`{column}` IS NOT NULL AND u.`{source_column}` IS NULL"
        )).scalar_one()
        if unresolved:
            raise RuntimeError(f"Cannot migrate {table}.{column}: {unresolved} references cannot be mapped")


def _snapshot_constraints(inspector: sa.Inspector, table: str, column: str) -> dict:
    uniques = [unique for unique in inspector.get_unique_constraints(table) if column in unique["column_names"]]
    unique_names = {unique["name"] for unique in uniques}
    return {
        "foreign_keys": [fk for fk in inspector.get_foreign_keys(table) if column in fk["constrained_columns"]],
        "indexes": [index for index in inspector.get_indexes(table) if column in index["column_names"] and index["name"] not in unique_names],
        "uniques": uniques,
        "primary_key": inspector.get_pk_constraint(table) if column in inspector.get_pk_constraint(table).get("constrained_columns", []) else None,
    }


def _drop_constraints(table: str, snapshot: dict) -> None:
    for foreign_key in snapshot["foreign_keys"]:
        if foreign_key["name"]:
            op.drop_constraint(foreign_key["name"], table, type_="foreignkey")
    for unique in snapshot["uniques"]:
        if unique["name"]:
            op.drop_constraint(unique["name"], table, type_="unique")
    if snapshot["primary_key"]:
        op.drop_constraint(snapshot["primary_key"]["name"] or "PRIMARY", table, type_="primary")
    for index in snapshot["indexes"]:
        if index["name"]:
            op.drop_index(index["name"], table_name=table)


def _restore_constraints(table: str, column: str, target_column: str, snapshot: dict) -> None:
    for index in snapshot["indexes"]:
        op.create_index(index["name"], table, index["column_names"], unique=index.get("unique", False))
    if snapshot["primary_key"]:
        op.create_primary_key(snapshot["primary_key"]["name"] or "PRIMARY", table, snapshot["primary_key"]["constrained_columns"])
    for unique in snapshot["uniques"]:
        op.create_unique_constraint(unique["name"], table, unique["column_names"])
    for foreign_key in snapshot["foreign_keys"]:
        options = {key: value for key, value in foreign_key.get("options", {}).items() if key in {"ondelete", "onupdate"}}
        referred_columns = [target_column for _value in foreign_key["referred_columns"]]
        op.create_foreign_key(foreign_key["name"], table, "user", foreign_key["constrained_columns"], referred_columns, **options)


def _finish_attempt_constraints(connection: sa.Connection) -> None:
    unique_names = {item["name"] for item in sa.inspect(connection).get_unique_constraints("attempt")}
    if "uq_attempt_exam_student_no" not in unique_names:
        op.create_unique_constraint("uq_attempt_exam_student_no", "attempt", ["exam_id", "student_id", "attempt_no"])
    index_names = {item["name"] for item in sa.inspect(connection).get_indexes("attempt")}
    if "ix_attempt_exam_id_school_id_migration" in index_names:
        op.drop_index("ix_attempt_exam_id_school_id_migration", table_name="attempt")


def _migrate(source_column: str, target_column: str, temporary_type: sa.types.TypeEngine) -> None:
    connection = op.get_bind()
    current_types = [
        sa.inspect(connection).get_columns(table)
        for table, _column, _nullable in REFERENCES
    ]
    current_columns = {
        (table, column): next(item["type"] for item in columns if item["name"] == column)
        for (table, column, _nullable), columns in zip(REFERENCES, current_types)
    }
    if target_column == "school_id" and all(isinstance(value, sa.String) for value in current_columns.values()):
        # A prior MySQL DDL run completed the column swaps but stopped before
        # Alembic could record the revision; finish the index cleanup safely.
        _finish_attempt_constraints(connection)
        return
    _preflight(connection, source_column, target_column)
    inspector = sa.inspect(connection)
    snapshots = {(table, column): _snapshot_constraints(inspector, table, column) for table, column, _nullable in REFERENCES}

    for table, column, _nullable in REFERENCES:
        existing_columns = {item["name"] for item in sa.inspect(connection).get_columns(table)}
        if f"{column}__new" not in existing_columns:
            op.add_column(table, sa.Column(f"{column}__new", temporary_type, nullable=True))
        connection.execute(sa.text(
            f"UPDATE `{table}` t JOIN `user` u ON u.`{source_column}` = t.`{column}` "
            f"SET t.`{column}__new` = u.`{target_column}` WHERE t.`{column}` IS NOT NULL"
        ))

    # The attempt unique key also supplies the index needed by its exam FK on
    # MySQL, so retain a temporary equivalent before replacing that key.
    attempt_indexes = {item["name"] for item in sa.inspect(connection).get_indexes("attempt")}
    if "ix_attempt_exam_id_school_id_migration" not in attempt_indexes:
        op.create_index("ix_attempt_exam_id_school_id_migration", "attempt", ["exam_id"], unique=False)

    for table, column, nullable in REFERENCES:
        missing = connection.execute(sa.text(
            f"SELECT COUNT(*) FROM `{table}` WHERE `{column}` IS NOT NULL AND `{column}__new` IS NULL"
        )).scalar_one()
        if missing:
            raise RuntimeError(f"Cannot migrate {table}.{column}: {missing} rows were not backfilled")
        if not nullable:
            nulls = connection.execute(sa.text(f"SELECT COUNT(*) FROM `{table}` WHERE `{column}__new` IS NULL")).scalar_one()
            if nulls:
                raise RuntimeError(f"Cannot migrate {table}.{column}: required values are missing")

    for table, column, nullable in REFERENCES:
        _drop_constraints(table, snapshots[(table, column)])
        op.drop_column(table, column)
        op.alter_column(table, f"{column}__new", new_column_name=column, existing_type=temporary_type, nullable=nullable)
        _restore_constraints(table, column, target_column, snapshots[(table, column)])

    _finish_attempt_constraints(connection)


def upgrade() -> None:
    _migrate("id", "school_id", sa.String(length=30))


def downgrade() -> None:
    _migrate("school_id", "id", sa.Integer())
