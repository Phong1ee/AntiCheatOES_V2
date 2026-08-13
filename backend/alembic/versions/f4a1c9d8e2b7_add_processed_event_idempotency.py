"""add processed event idempotency

Revision ID: f4a1c9d8e2b7
Revises: a1e6c8b2d4f0
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa


revision = "f4a1c9d8e2b7"
down_revision = "a1e6c8b2d4f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "processed_event",
        sa.Column("processed_event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("consumer_name", sa.String(length=100), nullable=False),
        sa.Column("event_id", sa.String(length=36), nullable=False),
        sa.Column("processed_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("processed_event_id"),
        sa.UniqueConstraint("consumer_name", "event_id", name="uq_processed_event_consumer_event"),
    )


def downgrade() -> None:
    op.drop_table("processed_event")
