"""add_result_strategy_and_final_score

Revision ID: f3a9c1d76e28
Revises: 087561525b57
Create Date: 2026-08-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a9c1d76e28'
down_revision: Union[str, Sequence[str], None] = '087561525b57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        'exam_setting',
        sa.Column(
            'result_strategy',
            sa.Enum('highest', 'average', 'last_attempt', name='resultstrategy'),
            nullable=False,
            server_default='highest',
        ),
    )
    op.add_column(
        'student_exam',
        sa.Column('final_score', sa.Numeric(5, 2), nullable=True),
    )


def downgrade():
    op.drop_column('student_exam', 'final_score')
    op.drop_column('exam_setting', 'result_strategy')
