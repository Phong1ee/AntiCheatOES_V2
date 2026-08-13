"""add submit idempotency outbox

Revision ID: e88ab4b8ed63
Revises: cf1d75d372c8
Create Date: 2026-08-11 18:31:14.763448

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e88ab4b8ed63'
down_revision: Union[str, Sequence[str], None] = 'cf1d75d372c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add request-level submit idempotency and the transactional outbox."""
    op.add_column("attempt", sa.Column("submit_request_id", sa.String(length=64), nullable=True))
    op.create_unique_constraint("uq_attempt_submit_request_id", "attempt", ["submit_request_id"])
    op.create_table(
        "outbox_event",
        sa.Column("outbox_event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("aggregate_type", sa.String(length=50), nullable=False),
        sa.Column("aggregate_id", sa.String(length=64), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("outbox_event_id"),
        sa.UniqueConstraint("event_id", name="uq_outbox_event_event_id"),
    )


def downgrade() -> None:
    """Remove request-level submit idempotency and the transactional outbox."""
    op.drop_table("outbox_event")
    op.drop_constraint("uq_attempt_submit_request_id", "attempt", type_="unique")
    op.drop_column("attempt", "submit_request_id")
