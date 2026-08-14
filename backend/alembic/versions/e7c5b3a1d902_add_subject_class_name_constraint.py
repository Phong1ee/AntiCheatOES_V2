"""add subject class name constraint

Revision ID: e7c5b3a1d902
Revises: d2f6a4b9c8e0
"""

from alembic import op
import sqlalchemy as sa


revision = "e7c5b3a1d902"
down_revision = "d2f6a4b9c8e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {item["name"] for item in inspector.get_unique_constraints("class")}
    if "uq_class_subject_name" not in existing:
        op.create_unique_constraint("uq_class_subject_name", "class", ["subject_id", "class_name"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {item["name"] for item in inspector.get_unique_constraints("class")}
    if "uq_class_subject_name" in existing:
        op.drop_constraint("uq_class_subject_name", "class", type_="unique")
