"""add persistent exam status

Revision ID: b8e31c4d7a92
Revises: 7d4c2a1f9b80
Create Date: 2026-07-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8e31c4d7a92"
down_revision: Union[str, Sequence[str], None] = "7d4c2a1f9b80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "exam",
        sa.Column(
            "status",
            sa.Enum("draft", "published", "archived", name="examstatus"),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("exam", "status")
