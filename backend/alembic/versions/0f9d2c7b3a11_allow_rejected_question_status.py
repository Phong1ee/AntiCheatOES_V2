"""allow rejected question status

Revision ID: 0f9d2c7b3a11
Revises: db5770a72011
Create Date: 2026-07-18

"""
from typing import Sequence, Union

from alembic import op


revision: str = "0f9d2c7b3a11"
down_revision: Union[str, Sequence[str], None] = "db5770a72011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE question MODIFY COLUMN question_status "
        "ENUM('draft', 'pending', 'approved', 'rejected') NULL"
    )


def downgrade() -> None:
    op.execute("UPDATE question SET question_status = 'draft' WHERE question_status = 'rejected'")
    op.execute(
        "ALTER TABLE question MODIFY COLUMN question_status "
        "ENUM('draft', 'pending', 'approved') NULL"
    )
