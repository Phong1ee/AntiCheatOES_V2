"""question subject ownership, chapter association, and true-false type

Revision ID: 9c7d2f1a6b40
Revises: 4a36e62181f2, aab2d023fa8d, e48e80b4217b
Create Date: 2026-07-16

The legacy revisions were created as three independent roots. Depending on all
three makes this revision the single repository head without modifying already
applied migration files.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c7d2f1a6b40"
down_revision: Union[str, Sequence[str], None] = (
    "4a36e62181f2",
    "aab2d023fa8d",
    "e48e80b4217b",
)
branch_labels = None
depends_on = None


def _drop_question_chapter_fk_and_indexes() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for foreign_key in inspector.get_foreign_keys("question"):
        if foreign_key.get("constrained_columns") == ["chapter_id"]:
            op.drop_constraint(foreign_key["name"], "question", type_="foreignkey")
    inspector = sa.inspect(bind)
    for index in inspector.get_indexes("question"):
        if index.get("column_names") == ["chapter_id"]:
            op.drop_index(index["name"], table_name="question")


def upgrade() -> None:
    bind = op.get_bind()

    # Abort before MySQL's auto-committing DDL if any subject cannot be inferred.
    unresolved = bind.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM question q
            LEFT JOIN chapter c ON c.chapter_id = q.chapter_id
            WHERE q.chapter_id IS NULL OR c.subject_id IS NULL
            """
        )
    ).scalar_one()
    if unresolved:
        raise RuntimeError(
            f"Cannot migrate {unresolved} legacy question row(s): chapter/subject ownership is missing. "
            "Assign each row a valid chapter with a subject, then rerun the migration."
        )

    op.add_column("question", sa.Column("subject_id", sa.String(length=20), nullable=True))
    op.create_table(
        "chapter_question",
        sa.Column("chapter_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapter.chapter_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["question.question_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("chapter_id", "question_id"),
    )
    op.execute(
        """
        INSERT INTO chapter_question (chapter_id, question_id)
        SELECT chapter_id, question_id FROM question WHERE chapter_id IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE question q
        JOIN chapter c ON c.chapter_id = q.chapter_id
        SET q.subject_id = c.subject_id
        """
    )
    remaining = bind.execute(sa.text("SELECT COUNT(*) FROM question WHERE subject_id IS NULL")).scalar_one()
    if remaining:
        raise RuntimeError(f"Subject backfill unexpectedly left {remaining} question row(s) unresolved")

    op.alter_column("question", "subject_id", existing_type=sa.String(length=20), nullable=False)
    op.create_foreign_key(
        "fk_question_subject_id",
        "question",
        "subject",
        ["subject_id"],
        ["subject_id"],
        ondelete="RESTRICT",
    )
    op.execute(
        "ALTER TABLE question MODIFY COLUMN question_type "
        "ENUM('MCQ', 'essay', 'true-false') NULL"
    )
    _drop_question_chapter_fk_and_indexes()
    op.drop_column("question", "chapter_id")


def downgrade() -> None:
    bind = op.get_bind()
    true_false_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM question WHERE question_type = 'true-false'")
    ).scalar_one()
    if true_false_count:
        raise RuntimeError(
            f"Cannot downgrade while {true_false_count} true-false question row(s) exist; "
            "convert or remove those rows first to avoid data corruption."
        )

    op.add_column("question", sa.Column("chapter_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE question q
        JOIN (
            SELECT question_id, MIN(chapter_id) AS chapter_id
            FROM chapter_question
            GROUP BY question_id
        ) cq ON cq.question_id = q.question_id
        SET q.chapter_id = cq.chapter_id
        """
    )
    op.create_foreign_key(
        "fk_question_chapter_id",
        "question",
        "chapter",
        ["chapter_id"],
        ["chapter_id"],
        ondelete="CASCADE",
    )
    op.drop_table("chapter_question")
    op.drop_constraint("fk_question_subject_id", "question", type_="foreignkey")
    op.drop_column("question", "subject_id")
    op.execute("ALTER TABLE question MODIFY COLUMN question_type ENUM('MCQ', 'essay') NULL")
