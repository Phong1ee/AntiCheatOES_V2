"""repair fresh exam and student reference schema parity

Revision ID: d2f6a4b9c8e0
Revises: f4a1c9d8e2b7

The historic user-reference migration omitted ``exam.manage_by`` and
``student_exam.student_id``.  A separate historic omission never added
``exam.subject_id``.  This forward-only revision repairs fresh databases and
leaves databases that already have the current shape unchanged.
"""

from alembic import op
import sqlalchemy as sa


revision = "d2f6a4b9c8e0"
down_revision = "f4a1c9d8e2b7"
branch_labels = None
depends_on = None


def _column_type(table: str, column: str) -> sa.types.TypeEngine:
    return next(item["type"] for item in sa.inspect(op.get_bind()).get_columns(table) if item["name"] == column)


def _foreign_keys(table: str, column: str) -> list[dict]:
    return [
        item
        for item in sa.inspect(op.get_bind()).get_foreign_keys(table)
        if column in item["constrained_columns"]
    ]


def _drop_column_foreign_keys(table: str, column: str) -> None:
    for foreign_key in _foreign_keys(table, column):
        if foreign_key["name"]:
            op.drop_constraint(foreign_key["name"], table, type_="foreignkey")


def _validate_user_mapping(table: str, column: str) -> None:
    connection = op.get_bind()
    invalid_users = connection.execute(
        sa.text("SELECT COUNT(*) FROM `user` WHERE school_id IS NULL OR TRIM(school_id) = ''")
    ).scalar_one()
    if invalid_users:
        raise RuntimeError("Cannot repair user references: user.school_id contains blank values")

    unresolved = connection.execute(
        sa.text(
            f"SELECT COUNT(*) FROM `{table}` t LEFT JOIN `user` u ON u.id = t.`{column}` "
            f"WHERE t.`{column}` IS NOT NULL AND u.id IS NULL"
        )
    ).scalar_one()
    if unresolved:
        raise RuntimeError(f"Cannot repair {table}.{column}: {unresolved} values cannot map to user.school_id")


def _convert_exam_manager() -> None:
    if isinstance(_column_type("exam", "manage_by"), sa.String):
        return

    connection = op.get_bind()
    _validate_user_mapping("exam", "manage_by")
    op.add_column("exam", sa.Column("manage_by__school_id", sa.String(length=30), nullable=True))
    connection.execute(
        sa.text(
            "UPDATE exam e JOIN `user` u ON u.id = e.manage_by "
            "SET e.manage_by__school_id = u.school_id WHERE e.manage_by IS NOT NULL"
        )
    )
    missing = connection.execute(
        sa.text("SELECT COUNT(*) FROM exam WHERE manage_by IS NOT NULL AND manage_by__school_id IS NULL")
    ).scalar_one()
    if missing:
        raise RuntimeError(f"Cannot repair exam.manage_by: {missing} values were not backfilled")

    _drop_column_foreign_keys("exam", "manage_by")
    op.drop_column("exam", "manage_by")
    op.alter_column(
        "exam",
        "manage_by__school_id",
        new_column_name="manage_by",
        existing_type=sa.String(length=30),
        nullable=True,
    )
    op.create_foreign_key(
        "fk_exam_manager_school_id",
        "exam",
        "user",
        ["manage_by"],
        ["school_id"],
        ondelete="SET NULL",
    )


def _convert_student_exam_student() -> None:
    if isinstance(_column_type("student_exam", "student_id"), sa.String):
        return

    connection = op.get_bind()
    _validate_user_mapping("student_exam", "student_id")
    op.add_column("student_exam", sa.Column("student_id__school_id", sa.String(length=30), nullable=True))
    connection.execute(
        sa.text(
            "UPDATE student_exam se JOIN `user` u ON u.id = se.student_id "
            "SET se.student_id__school_id = u.school_id"
        )
    )
    missing = connection.execute(
        sa.text("SELECT COUNT(*) FROM student_exam WHERE student_id__school_id IS NULL")
    ).scalar_one()
    if missing:
        raise RuntimeError(f"Cannot repair student_exam.student_id: {missing} values were not backfilled")

    inspector = sa.inspect(connection)
    primary_key = inspector.get_pk_constraint("student_exam")
    _drop_column_foreign_keys("student_exam", "student_id")
    if "student_id" in primary_key.get("constrained_columns", []):
        op.drop_constraint(primary_key["name"] or "PRIMARY", "student_exam", type_="primary")
    op.drop_column("student_exam", "student_id")
    op.alter_column(
        "student_exam",
        "student_id__school_id",
        new_column_name="student_id",
        existing_type=sa.String(length=30),
        nullable=False,
    )
    op.create_primary_key(
        primary_key["name"] or "PRIMARY",
        "student_exam",
        ["student_id" if value == "student_id" else value for value in primary_key["constrained_columns"]],
    )
    op.create_foreign_key(
        "fk_student_exam_student_school_id",
        "student_exam",
        "user",
        ["student_id"],
        ["school_id"],
        ondelete="CASCADE",
    )


def _ensure_exam_subject() -> None:
    connection = op.get_bind()
    columns = {item["name"] for item in sa.inspect(connection).get_columns("exam")}
    if "subject_id" not in columns:
        op.add_column("exam", sa.Column("subject_id", sa.String(length=20), nullable=True))

    has_subject_fk = any(
        item["constrained_columns"] == ["subject_id"] and item["referred_table"] == "subject"
        for item in sa.inspect(connection).get_foreign_keys("exam")
    )
    if not has_subject_fk:
        op.create_foreign_key("fk_exam_subject_id", "exam", "subject", ["subject_id"], ["subject_id"])


def upgrade() -> None:
    _convert_exam_manager()
    _convert_student_exam_student()
    _ensure_exam_subject()


def downgrade() -> None:
    raise RuntimeError(
        "This schema-parity repair deliberately has no safe downgrade; it converts "
        "foreign-key business identifiers from user.id to user.school_id."
    )
