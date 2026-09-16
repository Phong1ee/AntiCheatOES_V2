"""add student exam notifications

Revision ID: c3d9e6f2a8b4
Revises: d8b7e2c5a4f1
Create Date: 2026-09-16
"""

from alembic import op
import sqlalchemy as sa


revision = "c3d9e6f2a8b4"
down_revision = "d8b7e2c5a4f1"
branch_labels = None
depends_on = None


notification_type = sa.Enum(
    "NEW_EXAM_ASSIGNED",
    "EXAM_SCHEDULE_CHANGED",
    "EXAM_DURATION_CHANGED",
    "EXAM_CANCELLED",
    "EXAM_OPENED",
    "EXAM_CLOSED",
    "EXAM_CODE_CHANGED",
    name="notificationtype",
)


def upgrade() -> None:
    op.create_table(
        "notification",
        sa.Column("notification_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.String(length=30), nullable=False),
        sa.Column("exam_id", sa.Integer(), nullable=True),
        sa.Column("type", notification_type, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["student_id"], ["user.school_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exam_id"], ["exam.exam_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("notification_id"),
    )
    op.create_index(
        "ix_notification_student_created",
        "notification",
        ["student_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_notification_student_read",
        "notification",
        ["student_id", "is_read"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notification_student_read", table_name="notification")
    op.drop_index("ix_notification_student_created", table_name="notification")
    op.drop_table("notification")
