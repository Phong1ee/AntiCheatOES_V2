"""add durable exam email delivery records

Revision ID: 92be8f6c3d10
Revises: 64ae81a19f78
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa


revision = "92be8f6c3d10"
down_revision = "64ae81a19f78"
branch_labels = None
depends_on = None


delivery_type = sa.Enum("EXAM_ASSIGNED", "REMINDER_30M", name="exemaildeliverytype")
delivery_status = sa.Enum("QUEUED", "SENT", "FAILED", name="emaildeliverystatus")


def upgrade() -> None:
    op.create_table(
        "exam_email_delivery",
        sa.Column("delivery_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exam_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.String(length=30), nullable=False),
        sa.Column("delivery_type", delivery_type, nullable=False),
        sa.Column("exam_start_time", sa.DateTime(), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(), nullable=False),
        sa.Column("delivery_key", sa.String(length=64), nullable=False),
        sa.Column("status", delivery_status, nullable=False, server_default="QUEUED"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("skipped_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["exam_id"], ["exam.exam_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["user.school_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("delivery_id"),
        sa.UniqueConstraint("delivery_key", name="uq_exam_email_delivery_key"),
    )
    op.create_index("ix_exam_email_delivery_due", "exam_email_delivery", ["status", "scheduled_for"])
    op.create_index("ix_exam_email_delivery_exam_student", "exam_email_delivery", ["exam_id", "student_id"])


def downgrade() -> None:
    op.drop_index("ix_exam_email_delivery_exam_student", table_name="exam_email_delivery")
    op.drop_index("ix_exam_email_delivery_due", table_name="exam_email_delivery")
    op.drop_table("exam_email_delivery")
