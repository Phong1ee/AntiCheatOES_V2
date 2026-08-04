"""make exam code optional

Revision ID: b8d4f2a6c105
Revises: a7c3e91f4b02
Create Date: 2026-08-05
"""

from typing import Sequence, Union

from alembic import op


revision: str = "b8d4f2a6c105"
down_revision: Union[str, Sequence[str], None] = "a7c3e91f4b02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE exam SET examcode = NULL WHERE TRIM(examcode) = ''")
    # MODIFY changes nullability only; MySQL retains the existing unique index.
    op.execute("ALTER TABLE exam MODIFY COLUMN examcode VARCHAR(20) NULL")


def downgrade() -> None:
    # Generate deterministic, per-row codes before restoring NOT NULL. Existing
    # non-null codes and the unique index remain unchanged.
    op.execute(
        "UPDATE exam SET examcode = CONCAT('D', LPAD(CAST(exam_id AS CHAR), 19, '0')) "
        "WHERE examcode IS NULL"
    )
    op.execute("ALTER TABLE exam MODIFY COLUMN examcode VARCHAR(20) NOT NULL")
