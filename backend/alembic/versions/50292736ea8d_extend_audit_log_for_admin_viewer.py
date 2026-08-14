"""extend audit log for admin viewer

Revision ID: 50292736ea8d
Revises: cb1a9d6e4f72
Create Date: 2026-08-14 14:36:58.056604

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "50292736ea8d"
down_revision = "cb1a9d6e4f72"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "audit_log",
        sa.Column("outcome", sa.String(length=20), nullable=False, server_default=sa.text("'SUCCESS'")),
    )
    op.add_column("audit_log", sa.Column("client_ip", sa.String(length=45), nullable=True))
    op.add_column("audit_log", sa.Column("user_agent", sa.String(length=512), nullable=True))
    op.create_index("ix_audit_log_created", "audit_log", ["created_at"], unique=False)
    op.create_index("ix_audit_log_action_created", "audit_log", ["action", "created_at"], unique=False)
    op.create_index("ix_audit_log_role_created", "audit_log", ["actor_role", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_log_role_created", table_name="audit_log")
    op.drop_index("ix_audit_log_action_created", table_name="audit_log")
    op.drop_index("ix_audit_log_created", table_name="audit_log")
    op.drop_column("audit_log", "user_agent")
    op.drop_column("audit_log", "client_ip")
    op.drop_column("audit_log", "outcome")
