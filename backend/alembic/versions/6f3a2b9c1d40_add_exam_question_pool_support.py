"""add exam question copy-on-write and pool support

Revision ID: 6f3a2b9c1d40
Revises: 14caa6f1995f
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6f3a2b9c1d40"
down_revision: Union[str, Sequence[str], None] = "14caa6f1995f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "question",
        sa.Column("source_question_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_question_source_question",
        "question",
        "question",
        ["source_question_id"],
        ["question_id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "exam",
        sa.Column(
            "question_selection_mode",
            sa.Enum("manual", "fixed_randomization", "pool", name="questionselectionmode"),
            nullable=False,
            server_default="manual",
        ),
    )
    op.alter_column(
        "exam_question",
        "question_point",
        existing_type=sa.Integer(),
        type_=sa.Numeric(10, 2),
        existing_nullable=False,
    )
    op.add_column(
        "attempt_question",
        sa.Column("question_point", sa.Numeric(10, 2), nullable=True),
    )
    op.execute(
        """
        UPDATE attempt_question aq
        JOIN attempt a ON a.attempt_id = aq.attempt_id
        JOIN exam_question eq
          ON eq.exam_id = a.exam_id
         AND eq.question_id = aq.question_id
        SET aq.question_point = eq.question_point
        """
    )
    op.create_unique_constraint(
        "uq_attempt_exam_student_no",
        "attempt",
        ["exam_id", "student_id", "attempt_no"],
    )

    op.create_table(
        "exam_pool_config",
        sa.Column("pool_config_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exam_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.String(length=20), nullable=False),
        sa.Column("fixed_randomization", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["exam_id"], ["exam.exam_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subject.subject_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("pool_config_id"),
        sa.UniqueConstraint("exam_id", name="uq_exam_pool_config_exam"),
    )
    op.create_table(
        "exam_pool_rule",
        sa.Column("rule_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pool_config_id", sa.Integer(), nullable=False),
        sa.Column("chapter_id", sa.Integer(), nullable=False),
        sa.Column("lo_id", sa.Integer(), nullable=True),
        sa.Column(
            "difficulty",
            sa.Enum("easy", "medium", "hard", name="questiondifficulty"),
            nullable=False,
        ),
        sa.Column("draw_count", sa.Integer(), nullable=False),
        sa.CheckConstraint("draw_count > 0", name="ck_exam_pool_rule_draw_positive"),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapter.chapter_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["pool_config_id"], ["exam_pool_config.pool_config_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["lo_id"], ["lo.lo_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("rule_id"),
        sa.UniqueConstraint(
            "pool_config_id",
            "chapter_id",
            "lo_id",
            "difficulty",
            name="uq_exam_pool_rule_taxonomy",
        ),
    )
    op.create_table(
        "exam_pool_question",
        sa.Column("rule_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["question_id"], ["question.question_id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["rule_id"], ["exam_pool_rule.rule_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("rule_id", "question_id"),
    )


def downgrade() -> None:
    op.drop_table("exam_pool_question")
    op.drop_table("exam_pool_rule")
    op.drop_table("exam_pool_config")
    op.drop_constraint("uq_attempt_exam_student_no", "attempt", type_="unique")
    op.drop_column("attempt_question", "question_point")
    op.alter_column(
        "exam_question",
        "question_point",
        existing_type=sa.Numeric(10, 2),
        type_=sa.Integer(),
        existing_nullable=False,
    )
    op.drop_column("exam", "question_selection_mode")
    op.drop_constraint("fk_question_source_question", "question", type_="foreignkey")
    op.drop_column("question", "source_question_id")
