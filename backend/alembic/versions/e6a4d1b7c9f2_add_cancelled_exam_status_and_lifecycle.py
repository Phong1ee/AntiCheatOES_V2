"""add cancelled exam status and lifecycle notification state

Revision ID: e6a4d1b7c9f2
Revises: c3d9e6f2a8b4
Create Date: 2026-09-16
"""

from alembic import op
import sqlalchemy as sa


revision = "e6a4d1b7c9f2"
down_revision = "c3d9e6f2a8b4"
branch_labels = None
depends_on = None


old_exam_status = sa.Enum("draft", "published", name="examstatus")
new_exam_status = sa.Enum("draft", "published", "cancelled", name="examstatus")
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
    op.alter_column(
        "exam",
        "status",
        existing_type=old_exam_status,
        type_=new_exam_status,
        existing_nullable=False,
        existing_server_default=sa.text("'draft'"),
    )
    op.create_table(
        "exam_notification_lifecycle",
        sa.Column("lifecycle_event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exam_id", sa.Integer(), nullable=False),
        sa.Column("notification_type", notification_type, nullable=False),
        sa.Column("boundary_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint(
            "notification_type IN ('EXAM_OPENED', 'EXAM_CLOSED')",
            name="ck_exam_notification_lifecycle_type",
        ),
        sa.ForeignKeyConstraint(["exam_id"], ["exam.exam_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("lifecycle_event_id"),
        sa.UniqueConstraint(
            "exam_id",
            "notification_type",
            "boundary_at",
            name="uq_exam_notification_lifecycle_boundary",
        ),
    )


def downgrade() -> None:
    op.drop_table("exam_notification_lifecycle")
    exam = sa.table("exam", sa.column("status", sa.String(length=20)))
    op.execute(exam.update().where(exam.c.status == "cancelled").values(status="draft"))
    op.alter_column(
        "exam",
        "status",
        existing_type=new_exam_status,
        type_=old_exam_status,
        existing_nullable=False,
        existing_server_default=sa.text("'draft'"),
    )
