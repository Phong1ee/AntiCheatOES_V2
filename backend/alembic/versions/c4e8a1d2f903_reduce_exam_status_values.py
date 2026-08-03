"""reduce exam status values

Revision ID: c4e8a1d2f903
Revises: f3a9c1d76e28
Create Date: 2026-08-03
"""

from typing import Sequence, Union

from alembic import op


revision: str = "c4e8a1d2f903"
down_revision: Union[str, Sequence[str], None] = "f3a9c1d76e28"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Archived rows must be converted while the old enum still accepts the value.
    op.execute("UPDATE exam SET status = 'draft' WHERE status = 'archived'")
    op.execute(
        "ALTER TABLE exam MODIFY COLUMN status "
        "ENUM('draft', 'published') NOT NULL DEFAULT 'draft'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE exam MODIFY COLUMN status "
        "ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft'"
    )
    # Rows converted to draft during upgrade cannot be distinguished from original drafts.
