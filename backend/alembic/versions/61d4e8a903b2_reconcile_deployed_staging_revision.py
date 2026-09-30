"""Reconcile the deployed Alembic revision marker.

Revision ID: 61d4e8a903b2
Revises: 92be8f6c3d10
Create Date: 2026-09-30

The shared staging database was already stamped at this revision, but the
original migration file is absent from every repository branch. Schema
inspection confirmed it matches the ``92be8f6c3d10`` model state, so this
marker restores a linear, deployable migration history without changing data.
"""

from typing import Sequence, Union


revision: str = "61d4e8a903b2"
down_revision: Union[str, Sequence[str], None] = "92be8f6c3d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The deployed database already has the schema represented by its parent.
    pass


def downgrade() -> None:
    pass
