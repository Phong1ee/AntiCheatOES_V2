"""normalize exam scores to the fixed ten-point scale

Revision ID: e2a7c4d91b30
Revises: b8d4f2a6c105
Create Date: 2026-08-05

Historical question allocations and attempt snapshots are intentionally not
rescaled. They remain the raw maximum scores used to reconstruct each attempt's
denominator. ``attempt.score_scale_version`` makes the conversion idempotent.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op


revision: str = "e2a7c4d91b30"
down_revision: Union[str, Sequence[str], None] = "b8d4f2a6c105"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _scalar(sql: str) -> int:
    if context.is_offline_mode():
        return 0
    return int(op.get_bind().execute(sa.text(sql)).scalar() or 0)


def upgrade() -> None:
    op.add_column(
        "attempt",
        sa.Column("score_scale_version", sa.SmallInteger(), server_default="1", nullable=False),
    )
    op.add_column(
        "exam_pool_rule",
        sa.Column(
            "max_score_per_question",
            sa.Numeric(10, 2),
            server_default="1.00",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_exam_pool_rule_max_score_positive",
        "exam_pool_rule",
        "max_score_per_question > 0",
    )

    op.alter_column(
        "exam",
        "passing_score",
        existing_type=sa.Integer(),
        type_=sa.Numeric(4, 2),
        existing_nullable=True,
        server_default="5.00",
    )
    op.alter_column(
        "attempt_question",
        "question_point_snapshot",
        existing_type=sa.Integer(),
        type_=sa.Numeric(10, 2),
        existing_nullable=True,
    )
    op.alter_column(
        "essay_answers",
        "score",
        existing_type=sa.Integer(),
        type_=sa.Numeric(10, 2),
        existing_nullable=True,
    )

    fallback_exam_scores = _scalar(
        "SELECT COUNT(*) FROM exam WHERE total_points IS NULL OR total_points <= 0 OR passing_score IS NULL"
    )
    op.execute(
        """
        UPDATE exam
        SET passing_score = CASE
            WHEN total_points IS NULL OR total_points <= 0 OR passing_score IS NULL THEN 5.00
            ELSE LEAST(10.00, GREATEST(0.00, ROUND((passing_score / total_points) * 10, 2)))
        END
        """
    )
    op.execute("UPDATE exam SET total_points = 10")
    op.alter_column(
        "exam",
        "total_points",
        existing_type=sa.Integer(),
        existing_nullable=True,
        server_default="10",
    )

    # Reconstruct raw earned points from immutable option snapshots whenever
    # present. Live options are used only for legacy rows without snapshots.
    op.execute(
        """
        UPDATE attempt AS target
        JOIN (
            SELECT
                a.attempt_id,
                SUM(COALESCE(aq.question_point_snapshot, aq.question_point, 0)) AS raw_possible,
                SUM(
                    CASE
                        WHEN LOWER(COALESCE(aq.question_type_snapshot, q.question_type)) = 'essay'
                            THEN COALESCE(ea.score, 0)
                        WHEN COALESCE(snapshot_option.is_correct, live_option.is_correct, 0) = 1
                            THEN COALESCE(aq.question_point_snapshot, aq.question_point, 0)
                        ELSE 0
                    END
                ) AS raw_earned
            FROM attempt AS a
            JOIN attempt_question AS aq ON aq.attempt_id = a.attempt_id
            JOIN question AS q ON q.question_id = aq.question_id
            LEFT JOIN mcq_answers AS ma
                ON ma.attempt_id = aq.attempt_id AND ma.question_id = aq.question_id
            LEFT JOIN options AS live_option ON live_option.options_id = ma.selected_option_id
            LEFT JOIN essay_answers AS ea
                ON ea.attempt_id = aq.attempt_id AND ea.question_id = aq.question_id
            LEFT JOIN JSON_TABLE(
                COALESCE(aq.options_snapshot, JSON_ARRAY()),
                '$[*]' COLUMNS (
                    option_id INT PATH '$.id',
                    is_correct BOOLEAN PATH '$.isCorrect'
                )
            ) AS snapshot_option ON snapshot_option.option_id = ma.selected_option_id
            WHERE a.score_scale_version = 1
            GROUP BY a.attempt_id
        ) AS calculated ON calculated.attempt_id = target.attempt_id
        SET
            target.score = LEAST(
                10.00,
                GREATEST(0.00, ROUND((calculated.raw_earned / calculated.raw_possible) * 10, 2))
            ),
            target.score_scale_version = 2
        WHERE calculated.raw_possible > 0
        """
    )

    # Blank legacy essays were already backfilled by d5f9b2e3a014. Keep this
    # narrow idempotent guard for databases that skipped that data operation.
    op.execute(
        """
        UPDATE essay_answers
        SET score = 0
        WHERE score IS NULL
          AND TRIM(REPLACE(REPLACE(REPLACE(COALESCE(answer_text, ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), '')) = ''
        """
    )

    # Official per-student scores are rebuilt only from comparable normalized,
    # finalized attempts without non-blank ungraded essays.
    eligible_attempts = """
        a.submitted_at IS NOT NULL
        AND a.status IN ('submitted', 'terminated')
        AND a.score_scale_version = 2
        AND NOT EXISTS (
            SELECT 1 FROM essay_answers pending
            WHERE pending.attempt_id = a.attempt_id
              AND pending.score IS NULL
              AND TRIM(REPLACE(REPLACE(REPLACE(COALESCE(pending.answer_text, ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), '')) <> ''
        )
    """
    op.execute(
        f"""
        UPDATE student_exam AS se
        LEFT JOIN exam_setting AS settings ON settings.exam_id = se.exam_id
        SET se.final_score = CASE COALESCE(settings.result_strategy, 'highest')
            WHEN 'average' THEN (
                SELECT ROUND(AVG(a.score), 2) FROM attempt a
                WHERE a.exam_id = se.exam_id AND a.student_id = se.student_id AND {eligible_attempts}
            )
            WHEN 'last_attempt' THEN (
                SELECT a.score FROM attempt a
                WHERE a.exam_id = se.exam_id AND a.student_id = se.student_id AND {eligible_attempts}
                ORDER BY a.attempt_no DESC, a.submitted_at DESC, a.attempt_id DESC LIMIT 1
            )
            ELSE (
                SELECT MAX(a.score) FROM attempt a
                WHERE a.exam_id = se.exam_id AND a.student_id = se.student_id AND {eligible_attempts}
            )
        END
        """
    )

    op.alter_column(
        "attempt",
        "score_scale_version",
        existing_type=sa.SmallInteger(),
        existing_nullable=False,
        server_default="2",
    )

    converted_attempts = _scalar("SELECT COUNT(*) FROM attempt WHERE score_scale_version = 2")
    skipped_attempts = _scalar("SELECT COUNT(*) FROM attempt WHERE score_scale_version = 1")
    print(
        "10-point migration report: "
        f"converted_attempts={converted_attempts}, "
        f"skipped_zero_denominator_attempts={skipped_attempts}, "
        f"invalid_or_missing_exam_scores_using_5.00_fallback={fallback_exam_scores}"
    )


def downgrade() -> None:
    # Normalized historical values cannot be expanded back to their original
    # absolute totals without guessing. The schema can be restored, but scores
    # and converted passing thresholds intentionally remain on the 10-point scale.
    op.drop_constraint(
        "ck_exam_pool_rule_max_score_positive",
        "exam_pool_rule",
        type_="check",
    )
    op.drop_column("exam_pool_rule", "max_score_per_question")
    op.drop_column("attempt", "score_scale_version")
    op.alter_column(
        "essay_answers",
        "score",
        existing_type=sa.Numeric(10, 2),
        type_=sa.Integer(),
        existing_nullable=True,
    )
    op.alter_column(
        "attempt_question",
        "question_point_snapshot",
        existing_type=sa.Numeric(10, 2),
        type_=sa.Integer(),
        existing_nullable=True,
    )
    op.alter_column(
        "exam",
        "passing_score",
        existing_type=sa.Numeric(4, 2),
        type_=sa.Integer(),
        existing_nullable=True,
        server_default="5",
    )
    op.alter_column(
        "exam",
        "total_points",
        existing_type=sa.Integer(),
        existing_nullable=True,
        server_default="100",
    )
