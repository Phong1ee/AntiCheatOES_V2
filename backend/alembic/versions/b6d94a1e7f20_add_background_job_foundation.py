"""add background job foundation

Revision ID: b6d94a1e7f20
Revises: 9f2b47a8c613
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa


revision = "b6d94a1e7f20"
down_revision = "9f2b47a8c613"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "background_job",
        sa.Column("job_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_type", sa.Enum("USER_IMPORT", "QUESTION_IMPORT", "REPORT_EXPORT", name="backgroundjobtype"), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "RUNNING", "COMPLETED", "FAILED", name="backgroundjobstatus"), nullable=False, server_default="PENDING"),
        sa.Column("requested_by", sa.String(length=30), nullable=False),
        sa.Column("business_key_hash", sa.String(length=64), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("result_metadata", sa.JSON(), nullable=True),
        sa.Column("error_metadata", sa.JSON(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["requested_by"], ["user.school_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("job_id"),
        sa.UniqueConstraint("job_type", "requested_by", "business_key_hash", name="uq_background_job_request_key"),
    )
    op.create_index("ix_background_job_status_created", "background_job", ["status", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_background_job_status_created", table_name="background_job")
    op.drop_table("background_job")
