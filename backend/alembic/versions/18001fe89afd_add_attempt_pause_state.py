"""add attempt pause state

Revision ID: 18001fe89afd
Revises: c7e51a9b2046
Create Date: 2026-10-07 12:43:37.416087

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '18001fe89afd'
down_revision: Union[str, Sequence[str], None] = 'c7e51a9b2046'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("attempt", sa.Column("paused_at", sa.DateTime(), nullable=True))
    op.add_column(
        "attempt",
        sa.Column("paused_total_seconds", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "attempt",
        sa.Column("awaiting_student_resume", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("attempt", "awaiting_student_resume")
    op.drop_column("attempt", "paused_total_seconds")
    op.drop_column("attempt", "paused_at")
