"""restore attempt student school id foreign key

Revision ID: 087561525b57
Revises: a391dec649ff
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "087561525b57"
down_revision: Union[str, Sequence[str], None] = "a391dec649ff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    foreign_keys = inspector.get_foreign_keys("attempt")
    if not any(item["constrained_columns"] == ["student_id"] for item in foreign_keys):
        op.create_foreign_key(
            "fk_attempt_student_school_id",
            "attempt",
            "user",
            ["student_id"],
            ["school_id"],
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for foreign_key in inspector.get_foreign_keys("attempt"):
        if foreign_key["name"] == "fk_attempt_student_school_id":
            op.drop_constraint(foreign_key["name"], "attempt", type_="foreignkey")
