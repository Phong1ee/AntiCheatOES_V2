"""Add explicit page pins; retain existing attempt snapshots.
Revision ID: c7e51a9b2046
Revises: 8a21c7e5b940
"""
from alembic import op
import sqlalchemy as sa

revision = "c7e51a9b2046"
down_revision = "8a21c7e5b940"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("exam_question", "exam_question_block"):
        if "pinned_page" not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}:
            op.add_column(table, sa.Column("pinned_page", sa.Integer(), nullable=True))
        op.execute(sa.text(f"""UPDATE {table} t LEFT JOIN exam_setting es ON es.exam_id = t.exam_id
            SET t.pinned_page = FLOOR((t.pinned_position - 1) / COALESCE(es.questions_per_page, 1)) + 1,
                t.pinned_position = NULL
            WHERE t.pinned_position IS NOT NULL AND t.pinned_page IS NULL"""))
        name = "ck_" + table + "_pinned_page"
        if name not in {c["name"] for c in sa.inspect(op.get_bind()).get_check_constraints(table)}:
            op.create_check_constraint(name, table, "pinned_page IS NULL OR pinned_page BETWEEN 1 AND 50000")


def downgrade():
    raise RuntimeError("Page pins can share a page and cannot be losslessly converted to unique global slots; use a reviewed forward migration")
