"""expand anti-cheat settings, attempts, and events

Revision ID: c9d1e8f2a4b6
Revises: e2a7c4d91b30
Create Date: 2026-08-06
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d1e8f2a4b6"
down_revision: Union[str, Sequence[str], None] = "e2a7c4d91b30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "exam_setting",
        sa.Column("anti_cheat_enabled", sa.Boolean(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "exam_setting",
        sa.Column("violation_limit", sa.Integer(), server_default=sa.text("5"), nullable=False),
    )
    op.execute(
        """
        UPDATE exam_setting
        SET
            anti_cheat_enabled = CASE
                WHEN force_fullscreen_thresh > 0
                  OR tab_switch_thresh > 0
                  OR copy_paste_thresh > 0 THEN 1
                ELSE 0
            END,
            violation_limit = CASE
                WHEN force_fullscreen_thresh > 0
                  OR tab_switch_thresh > 0
                  OR copy_paste_thresh > 0
                    THEN GREATEST(
                        1,
                        COALESCE(force_fullscreen_thresh, 0),
                        COALESCE(tab_switch_thresh, 0),
                        COALESCE(copy_paste_thresh, 0)
                    )
                ELSE 5
            END
        """
    )
    op.create_check_constraint(
        "ck_exam_setting_violation_limit_positive",
        "exam_setting",
        "violation_limit > 0",
    )

    op.add_column(
        "attempt",
        sa.Column("violation_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column("attempt", sa.Column("last_violation_at", sa.DateTime(), nullable=True))
    op.add_column("attempt", sa.Column("device_id_hash", sa.String(length=64), nullable=True))
    op.add_column("attempt", sa.Column("session_token_hash", sa.String(length=64), nullable=True))
    op.add_column("attempt", sa.Column("last_heartbeat_at", sa.DateTime(), nullable=True))
    op.create_check_constraint(
        "ck_attempt_violation_count_nonnegative",
        "attempt",
        "violation_count >= 0",
    )

    op.add_column(
        "exam_event",
        sa.Column("source", sa.String(length=30), server_default=sa.text("'system'"), nullable=False),
    )
    op.add_column(
        "exam_event",
        sa.Column("is_violation", sa.Boolean(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column("exam_event", sa.Column("client_event_id", sa.String(length=64), nullable=True))
    op.add_column("exam_event", sa.Column("metadata", sa.JSON(), nullable=True))
    # MySQL unique indexes permit multiple NULL values for legacy event rows.
    op.create_unique_constraint(
        "uq_exam_event_attempt_client_event",
        "exam_event",
        ["attempt_id", "client_event_id"],
    )
    op.create_index(
        "ix_exam_event_attempt_timestamp",
        "exam_event",
        ["attempt_id", "event_timestamp"],
        unique=False,
    )
    op.create_index(
        "ix_exam_event_attempt_violation_timestamp",
        "exam_event",
        ["attempt_id", "is_violation", "event_timestamp"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_exam_event_attempt_violation_timestamp", table_name="exam_event")
    op.drop_index("ix_exam_event_attempt_timestamp", table_name="exam_event")
    op.drop_constraint("uq_exam_event_attempt_client_event", "exam_event", type_="unique")
    op.drop_column("exam_event", "metadata")
    op.drop_column("exam_event", "client_event_id")
    op.drop_column("exam_event", "is_violation")
    op.drop_column("exam_event", "source")

    op.drop_constraint("ck_attempt_violation_count_nonnegative", "attempt", type_="check")
    op.drop_column("attempt", "last_heartbeat_at")
    op.drop_column("attempt", "session_token_hash")
    op.drop_column("attempt", "device_id_hash")
    op.drop_column("attempt", "last_violation_at")
    op.drop_column("attempt", "violation_count")

    op.drop_constraint("ck_exam_setting_violation_limit_positive", "exam_setting", type_="check")
    op.drop_column("exam_setting", "violation_limit")
    op.drop_column("exam_setting", "anti_cheat_enabled")
