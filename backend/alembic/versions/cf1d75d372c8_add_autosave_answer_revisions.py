"""add autosave answer revisions

Revision ID: cf1d75d372c8
Revises: d14c8a1e9f02
Create Date: 2026-08-11 18:18:58.920028

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cf1d75d372c8'
down_revision: Union[str, Sequence[str], None] = 'd14c8a1e9f02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add durable per-answer revisions for stale autosave protection."""
    op.add_column(
        "mcq_answers",
        sa.Column("revision", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "essay_answers",
        sa.Column("revision", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    """Remove durable per-answer revisions."""
    op.drop_column("essay_answers", "revision")
    op.drop_column("mcq_answers", "revision")
