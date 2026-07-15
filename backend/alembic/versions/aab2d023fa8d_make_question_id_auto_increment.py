"""make question_id auto increment

Revision ID: aab2d023fa8d
Revises: 4a36e62181f2
Create Date: 2026-07-15 12:12:37.866417

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aab2d023fa8d'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Disable MySQL foreign key checks
    op.execute("SET FOREIGN_KEY_CHECKS = 0;")

    # 2. Alter the question_id column to add AUTO_INCREMENT
    op.alter_column(
        'question', 
        'question_id',
        existing_type=sa.Integer(),
        existing_nullable=False,
        autoincrement=True
    )

    # 3. Re-enable MySQL foreign key checks
    op.execute("SET FOREIGN_KEY_CHECKS = 1;")


def downgrade() -> None:
    # 1. Disable MySQL foreign key checks
    op.execute("SET FOREIGN_KEY_CHECKS = 0;")

    # 2. Remove AUTO_INCREMENT from question_id
    op.alter_column(
        'question', 
        'question_id',
        existing_type=sa.Integer(),
        existing_nullable=False,
        autoincrement=False
    )

    # 3. Re-enable MySQL foreign key checks
    op.execute("SET FOREIGN_KEY_CHECKS = 1;")