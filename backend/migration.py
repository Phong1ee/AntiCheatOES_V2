from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    op.add_column('user', sa.Column('username', sa.String(length=50), nullable=False, unique=True))

def downgrade() -> None:
    op.drop_column('user', 'username')