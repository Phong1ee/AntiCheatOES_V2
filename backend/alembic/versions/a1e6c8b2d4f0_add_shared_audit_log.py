"""add shared audit log

Revision ID: a1e6c8b2d4f0
Revises: b6d94a1e7f20
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa


revision = "a1e6c8b2d4f0"
down_revision = "b6d94a1e7f20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column("audit_log_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor_school_id", sa.String(length=30), nullable=True),
        sa.Column("actor_role", sa.String(length=20), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("audit_log_id"),
    )
    op.create_index("ix_audit_log_actor_created", "audit_log", ["actor_school_id", "created_at"], unique=False)
    op.create_index("ix_audit_log_entity_created", "audit_log", ["entity_type", "entity_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_log_entity_created", table_name="audit_log")
    op.drop_index("ix_audit_log_actor_created", table_name="audit_log")
    op.drop_table("audit_log")
