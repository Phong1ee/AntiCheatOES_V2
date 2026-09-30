"""Add per-measure anti-cheat policy to exam settings.

Revision ID: a5e8c2d4f901
Revises: e6a4d1b7c9f2
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa


revision = "a5e8c2d4f901"
down_revision = "e6a4d1b7c9f2"
branch_labels = None
depends_on = None


_EVENT_TYPES = (
    "TAB_HIDDEN", "WINDOW_BLUR", "FULLSCREEN_EXIT", "COPY_ATTEMPT",
    "PASTE_ATTEMPT", "CUT_ATTEMPT", "PRINT_ATTEMPT", "BLOCKED_SHORTCUT",
    "PAGE_REFRESH", "CAMERA_PERMISSION_DENIED", "CAMERA_TRACK_MUTED",
    "CAMERA_TRACK_ENDED", "NO_FACE_DETECTED", "MULTIPLE_FACES_DETECTED",
    "GAZE_AWAY_SUSTAINED", "HEAD_AWAY_SUSTAINED", "MIC_PERMISSION_DENIED",
    "MIC_TRACK_MUTED", "MIC_TRACK_ENDED", "MULTIPLE_VOICES_DETECTED",
)


def upgrade() -> None:
    op.add_column("exam_setting", sa.Column("anti_cheat_measures", sa.JSON(), nullable=True))
    # Existing exams retain their prior threshold for every newly exposed measure.
    arguments = ", ".join(
        f"'{event_type}', JSON_OBJECT('enabled', true, 'threshold', GREATEST(1, COALESCE(violation_limit, 5)))"
        for event_type in _EVENT_TYPES
    )
    op.execute(f"UPDATE exam_setting SET anti_cheat_measures = JSON_OBJECT({arguments})")


def downgrade() -> None:
    op.drop_column("exam_setting", "anti_cheat_measures")
