"""add exam setting

Revision ID: 7d4c2a1f9b80
Revises: c520a6e83086
Create Date: 2026-07-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d4c2a1f9b80"
down_revision: Union[str, Sequence[str], None] = "c520a6e83086"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "exam_setting",
        sa.Column("exam_id", sa.Integer(), nullable=False),
        sa.Column("shuffle_question", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("shuffle_answer_options", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("auto_submit_on_expire", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("grace_period", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("force_fullscreen_thresh", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("tab_switch_thresh", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("copy_paste_thresh", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("auto_grade", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.CheckConstraint("grace_period >= 0", name="ck_exam_setting_grace_period_nonnegative"),
        sa.CheckConstraint(
            "force_fullscreen_thresh >= 0",
            name="ck_exam_setting_force_fullscreen_thresh_nonnegative",
        ),
        sa.CheckConstraint("tab_switch_thresh >= 0", name="ck_exam_setting_tab_switch_thresh_nonnegative"),
        sa.CheckConstraint("copy_paste_thresh >= 0", name="ck_exam_setting_copy_paste_thresh_nonnegative"),
        sa.ForeignKeyConstraint(["exam_id"], ["exam.exam_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("exam_id"),
    )


def downgrade() -> None:
    op.drop_table("exam_setting")
