"""Snapshot anti-cheat policy per attempt.

Revision ID: 64ae81a19f78
Revises: a5e8c2d4f901
Create Date: 2026-09-30 15:27:43.557089

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "64ae81a19f78"
down_revision = "a5e8c2d4f901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("attempt", sa.Column("anti_cheat_policy_snapshot", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("attempt", "anti_cheat_policy_snapshot")
