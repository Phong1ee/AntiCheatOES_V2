"""add exam optimistic lock version

Revision ID: 9f2b47a8c613
Revises: e88ab4b8ed63
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa


revision = "9f2b47a8c613"
down_revision = "e88ab4b8ed63"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exam",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("exam", "version")
