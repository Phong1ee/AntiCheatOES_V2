"""update_resultvisibility_enum

Revision ID: e48e80b4217b
Revises: 
Create Date: 2026-07-07 21:52:45.024714

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e48e80b4217b'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Replace 'your_table_name' and 'your_column_name' with your actual table and column names
    op.execute("ALTER TABLE exam MODIFY COLUMN result_visibility ENUM('hidden', 'score-only', 'full')")

def downgrade():
    op.execute("ALTER TABLE exam MODIFY COLUMN result_visibility ENUM('hidden', 'score_only', 'full')")