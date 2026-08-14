"""add bulk data request

Revision ID: cb1a9d6e4f72
Revises: e7c5b3a1d902
"""

from alembic import op
import sqlalchemy as sa


revision = "cb1a9d6e4f72"
down_revision = "e7c5b3a1d902"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bulk_data_request",
        sa.Column("request_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "request_type",
            sa.Enum("QUESTION_BANK", "USER_IMPORT", name="bulkdatarequesttype"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("PENDING", "PROCESSING", "IMPORTED", "REJECTED", "FAILED", name="bulkdatarequeststatus"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("requested_by", sa.String(length=30), nullable=False),
        sa.Column("subject_id", sa.String(length=20), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_file_key", sa.String(length=500), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("teacher_note", sa.String(length=500), nullable=True),
        sa.Column("admin_note", sa.String(length=500), nullable=True),
        sa.Column("processed_by", sa.String(length=30), nullable=True),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.Column("background_job_id", sa.Integer(), nullable=True),
        sa.Column("result_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["background_job_id"], ["background_job.job_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["processed_by"], ["user.school_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by"], ["user.school_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["subject_id"], ["subject.subject_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("request_id"),
    )
    op.create_index("ix_bulk_data_request_status_created", "bulk_data_request", ["status", "created_at"], unique=False)
    op.create_index("ix_bulk_data_request_requested_by_created", "bulk_data_request", ["requested_by", "created_at"], unique=False)
    op.create_index("ix_bulk_data_request_type_status", "bulk_data_request", ["request_type", "status"], unique=False)
    op.create_index("ix_bulk_data_request_subject_status", "bulk_data_request", ["subject_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_bulk_data_request_subject_status", table_name="bulk_data_request")
    op.drop_index("ix_bulk_data_request_type_status", table_name="bulk_data_request")
    op.drop_index("ix_bulk_data_request_requested_by_created", table_name="bulk_data_request")
    op.drop_index("ix_bulk_data_request_status_created", table_name="bulk_data_request")
    op.drop_table("bulk_data_request")
