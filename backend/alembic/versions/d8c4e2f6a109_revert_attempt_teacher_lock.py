"""Revert the teacher-controlled attempt lock schema.

Revision ID: d8c4e2f6a109
Revises: b2d6a1e9f03
Create Date: 2026-09-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d8c4e2f6a109"
down_revision: Union[str, Sequence[str], None] = "b2d6a1e9f03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_attempt_exam_status_heartbeat", table_name="attempt")
    op.drop_column("attempt", "lock_reason")
    op.drop_column("attempt", "locked_by")
    op.drop_column("attempt", "locked_at")
    op.drop_column("attempt", "is_locked")


def downgrade() -> None:
    op.add_column(
        "attempt",
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("attempt", sa.Column("locked_at", sa.DateTime(), nullable=True))
    op.add_column("attempt", sa.Column("locked_by", sa.String(length=30), nullable=True))
    op.add_column("attempt", sa.Column("lock_reason", sa.String(length=255), nullable=True))
    op.create_index(
        "ix_attempt_exam_status_heartbeat",
        "attempt",
        ["exam_id", "status", "last_heartbeat_at"],
        unique=False,
    )
