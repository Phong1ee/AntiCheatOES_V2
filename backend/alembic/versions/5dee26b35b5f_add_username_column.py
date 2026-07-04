"""add username column

Revision ID: 5dee26b35b5f
Revises: 
Create Date: 2026-07-02 14:30:19.989450

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5dee26b35b5f'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    op.add_column('user', sa.Column('username', sa.String(length=50), nullable=False, unique=True))



def downgrade() -> None:

    op.drop_column('user', 'username') 

