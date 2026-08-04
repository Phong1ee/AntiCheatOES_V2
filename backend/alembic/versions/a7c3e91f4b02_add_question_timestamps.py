"""add created_at/updated_at to question

Revision ID: a7c3e91f4b02
Revises: 394eab1e3799
Create Date: 2026-08-05

The question table never captured when a question was created or last
edited, so the "Created" date in the Question Bank / Your Questions lists
always showed "Unknown" (the API hardcoded created_at/updated_at to null
since there was nothing to read). This adds real timestamp columns.

Existing rows get CURRENT_TIMESTAMP as a backfill default (their true
creation date was never recorded and can't be recovered) — going forward,
every new/edited question gets an accurate timestamp.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "a7c3e91f4b02"
down_revision: Union[str, Sequence[str], None] = "394eab1e3799"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE question
        ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE question DROP COLUMN updated_at")
    op.execute("ALTER TABLE question DROP COLUMN created_at")
