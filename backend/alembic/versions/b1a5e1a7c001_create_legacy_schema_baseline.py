"""Create the legacy schema required by the original Alembic roots.

Revision ID: b1a5e1a7c001
Revises:

The repository's first three revisions were authored against a manually
created database. They alter ``exam`` and ``question`` but none creates those
tables. This explicit baseline is the legacy schema immediately before those
roots: it deliberately omits columns/tables added by later revisions.
"""

from alembic import op
import sqlalchemy as sa


revision = "b1a5e1a7c001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    role = sa.Enum("student", "teacher", "admin", name="userrole")
    difficulty = sa.Enum("easy", "medium", "hard", name="questiondifficulty")
    question_type = sa.Enum("MCQ", "essay", name="questiontype")
    visibility = sa.Enum("hidden", "score-only", "full", name="resultvisibility")

    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("school_id", sa.String(30), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(100), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", role, nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_user"),
        sa.UniqueConstraint("school_id", name="uq_user_school_id"),
        sa.UniqueConstraint("email", name="uq_user_email"),
    )
    op.create_table(
        "subject",
        sa.Column("subject_id", sa.String(20), nullable=False),
        sa.Column("subject_name", sa.String(100), nullable=False),
        sa.Column("subject_description", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("subject_id", name="pk_subject"),
    )
    op.create_table(
        "lo",
        sa.Column("lo_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("lo_name", sa.String(100), nullable=False),
        sa.Column("lo_description", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("lo_id", name="pk_lo"),
    )
    op.create_table(
        "class",
        sa.Column("class_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("class_name", sa.String(100), nullable=False),
        sa.Column("subject_id", sa.String(20), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["subject_id"], ["subject.subject_id"], name="fk_class_subject"),
        sa.ForeignKeyConstraint(["teacher_id"], ["user.id"], name="fk_class_teacher"),
        sa.PrimaryKeyConstraint("class_id", name="pk_class"),
    )
    op.create_table(
        "student_class",
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["user.id"], name="fk_student_class_student"),
        sa.ForeignKeyConstraint(["class_id"], ["class.class_id"], name="fk_student_class_class"),
        sa.PrimaryKeyConstraint("student_id", "class_id", name="pk_student_class"),
    )
    op.create_table(
        "chapter",
        sa.Column("chapter_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("chapter_name", sa.String(100), nullable=False),
        sa.Column("chapter_description", sa.String(255), nullable=False),
        sa.Column("subject_id", sa.String(20), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["subject.subject_id"], name="fk_chapter_subject", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("chapter_id", name="pk_chapter"),
    )
    op.create_table(
        "chapter_lo",
        sa.Column("chapter_id", sa.Integer(), nullable=False),
        sa.Column("lo_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapter.chapter_id"], name="fk_chapter_lo_chapter", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lo_id"], ["lo.lo_id"], name="fk_chapter_lo_lo", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("chapter_id", "lo_id", name="pk_chapter_lo"),
    )
    op.create_table(
        "exam",
        sa.Column("exam_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("manage_by", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("examcode", sa.String(20), nullable=False),
        sa.Column("max_attempt", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), server_default=sa.text("90"), nullable=True),
        sa.Column("start_time", sa.DateTime(), nullable=True),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column("result_visibility", visibility, server_default=sa.text("'full'"), nullable=True),
        sa.ForeignKeyConstraint(["manage_by"], ["user.id"], name="fk_exam_manager", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("exam_id", name="pk_exam"),
        sa.UniqueConstraint("examcode", name="uq_exam_examcode"),
    )
    op.create_table(
        "question",
        sa.Column("question_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("question_text", sa.String(255), nullable=False),
        sa.Column("question_difficulties", difficulty, nullable=False),
        sa.Column("question_type", question_type, nullable=True),
        sa.Column("chapter_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapter.chapter_id"], name="fk_question_chapter", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["user.id"], name="fk_question_creator", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("question_id", name="pk_question"),
    )
    op.create_table(
        "options",
        sa.Column("options_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=True),
        sa.Column("options_text", sa.String(255), nullable=False),
        sa.Column("is_correct", sa.Boolean(), server_default=sa.text("0"), nullable=True),
        sa.ForeignKeyConstraint(["question_id"], ["question.question_id"], name="fk_options_question", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("options_id", name="pk_options"),
    )
    op.create_table(
        "exam_question",
        sa.Column("exam_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("question_point", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["exam_id"], ["exam.exam_id"], name="fk_exam_question_exam", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["question.question_id"], name="fk_exam_question_question", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("exam_id", "question_id", name="pk_exam_question"),
    )
    op.create_table(
        "lo_question",
        sa.Column("lo_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["lo_id"], ["lo.lo_id"], name="fk_lo_question_lo", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["question.question_id"], name="fk_lo_question_question", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("lo_id", "question_id", name="pk_lo_question"),
    )
    op.create_table(
        "student_exam",
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("exam_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["user.id"], name="fk_student_exam_student", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exam_id"], ["exam.exam_id"], name="fk_student_exam_exam", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("student_id", "exam_id", name="pk_student_exam"),
    )
    op.create_table(
        "attempt",
        sa.Column("attempt_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exam_id", sa.Integer(), nullable=True),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("attempt_no", sa.Integer(), nullable=True),
        sa.Column("score", sa.Numeric(5, 2), nullable=True),
        sa.Column("start_time", sa.TIMESTAMP(), nullable=True),
        sa.Column("end_time", sa.TIMESTAMP(), nullable=True),
        sa.Column("submitted_at", sa.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(["exam_id"], ["exam.exam_id"], name="fk_attempt_exam"),
        sa.ForeignKeyConstraint(["student_id"], ["user.id"], name="fk_attempt_student"),
        sa.PrimaryKeyConstraint("attempt_id", name="pk_attempt"),
    )
    op.create_table(
        "attempt_question",
        sa.Column("attempt_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempt.attempt_id"], name="fk_attempt_question_attempt"),
        sa.ForeignKeyConstraint(["question_id"], ["question.question_id"], name="fk_attempt_question_question"),
        sa.PrimaryKeyConstraint("attempt_id", "question_id", name="pk_attempt_question"),
    )
    op.create_table(
        "essay_answers",
        sa.Column("essay_answer_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=True),
        sa.Column("question_id", sa.Integer(), nullable=True),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id", "question_id"], ["attempt_question.attempt_id", "attempt_question.question_id"], name="fk_essay_attempt_question"),
        sa.PrimaryKeyConstraint("essay_answer_id", name="pk_essay_answers"),
        sa.UniqueConstraint("attempt_id", "question_id", name="uq_essay_answers_attempt_question"),
    )
    op.create_table(
        "mcq_answers",
        sa.Column("mcq_answer_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=True),
        sa.Column("question_id", sa.Integer(), nullable=True),
        sa.Column("selected_option_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id", "question_id"], ["attempt_question.attempt_id", "attempt_question.question_id"], name="fk_mcq_attempt_question"),
        sa.ForeignKeyConstraint(["selected_option_id"], ["options.options_id"], name="fk_mcq_option"),
        sa.PrimaryKeyConstraint("mcq_answer_id", name="pk_mcq_answers"),
    )
    op.create_table(
        "exam_event",
        sa.Column("event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=True),
        sa.Column("event_timestamp", sa.TIMESTAMP(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempt.attempt_id"], name="fk_exam_event_attempt"),
        sa.PrimaryKeyConstraint("event_id", name="pk_exam_event"),
    )


def downgrade() -> None:
    for table in (
        "exam_event", "mcq_answers", "essay_answers", "attempt_question", "attempt",
        "student_exam", "lo_question", "exam_question", "options", "question", "exam",
        "chapter_lo", "chapter", "student_class", "class", "lo", "subject", "user",
    ):
        op.drop_table(table)
