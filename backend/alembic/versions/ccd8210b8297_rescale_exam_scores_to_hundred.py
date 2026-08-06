"""rescale exam scores from the ten-point scale to the hundred-point scale

Revision ID: ccd8210b8297
Revises: f3b8d2a7c5e1
Create Date: 2026-08-06

e2a7c4d91b30 normalized every score onto a fixed 0-10 scale. This migration
keeps the same normalize(earned/possible) approach but changes the target
scale to 0-100, matching a percentage-style final score. Since every
score_scale_version=2 value is already an exact ratio * 10, converting to
the new scale is a straight `* 10` (no need to reconstruct raw totals from
snapshots again). Rows still stuck on score_scale_version=1 (pre-existing
zero-denominator edge cases skipped by the prior migration) are left as-is,
same limitation as before.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "ccd8210b8297"
down_revision: Union[str, Sequence[str], None] = "f3b8d2a7c5e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "exam",
        "passing_score",
        existing_type=sa.Numeric(4, 2),
        type_=sa.Numeric(5, 2),
        existing_nullable=True,
        server_default="50.00",
    )
    op.alter_column(
        "exam",
        "total_points",
        existing_type=sa.Integer(),
        existing_nullable=True,
        server_default="100",
    )

    op.execute(
        """
        UPDATE attempt
        SET score = LEAST(100.00, ROUND(score * 10, 2)),
            score_scale_version = 3
        WHERE score_scale_version = 2
        """
    )
    op.execute(
        """
        UPDATE student_exam
        SET final_score = LEAST(100.00, ROUND(final_score * 10, 2))
        WHERE final_score IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE exam
        SET passing_score = LEAST(100.00, ROUND(passing_score * 10, 2))
        WHERE passing_score IS NOT NULL
        """
    )
    op.execute("UPDATE exam SET total_points = 100")


def downgrade() -> None:
    op.execute("UPDATE exam SET total_points = 10")
    op.execute(
        """
        UPDATE exam
        SET passing_score = ROUND(passing_score / 10, 2)
        WHERE passing_score IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE student_exam
        SET final_score = ROUND(final_score / 10, 2)
        WHERE final_score IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE attempt
        SET score = ROUND(score / 10, 2),
            score_scale_version = 2
        WHERE score_scale_version = 3
        """
    )

    op.alter_column(
        "exam",
        "total_points",
        existing_type=sa.Integer(),
        existing_nullable=True,
        server_default="10",
    )
    op.alter_column(
        "exam",
        "passing_score",
        existing_type=sa.Numeric(5, 2),
        type_=sa.Numeric(4, 2),
        existing_nullable=True,
        server_default="5.00",
    )
