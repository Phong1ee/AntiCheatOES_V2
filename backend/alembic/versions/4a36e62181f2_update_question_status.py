"""update question_status

Revision ID: 4a36e62181f2
Revises: e48e80b4217b
Create Date: 2026-07-09 10:14:17.812092

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a36e62181f2'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

question_status_enum = sa.Enum('pending', 'approved', 'draft', name='questionstatus')
def upgrade() -> None:
    # 2. Create the enum type in the database first
    question_status_enum.create(op.get_bind(), checkfirst=True)
    
    # 3. Add the column to the question table
    op.add_column(
        'question',
        sa.Column('question_status', question_status_enum, nullable=True)
    )

def downgrade() -> None:
    # 1. Drop the column from the table
    op.drop_column('question', 'question_status')
    
    # 2. Drop the custom enum type from the database
    question_status_enum.drop(op.get_bind(), checkfirst=True)