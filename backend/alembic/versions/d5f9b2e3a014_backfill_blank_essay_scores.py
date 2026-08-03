"""backfill blank essay scores

Revision ID: d5f9b2e3a014
Revises: c4e8a1d2f903
Create Date: 2026-08-03
"""

from typing import Sequence, Union

from alembic import op


revision: str = "d5f9b2e3a014"
down_revision: Union[str, Sequence[str], None] = "c4e8a1d2f903"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE essay_answers
        SET answer_text = '', score = 0
        WHERE score IS NULL
          AND TRIM(
              REPLACE(
                  REPLACE(
                      REPLACE(COALESCE(answer_text, ''), CHAR(9), ''),
                      CHAR(10), ''
                  ),
                  CHAR(13), ''
              )
          ) = ''
        """
    )


def downgrade() -> None:
    # The previous NULL score cannot be inferred safely after blank answers become final zeros.
    pass
