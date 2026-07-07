import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
    Column,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class ResultVisibility(str, enum.Enum):
    hidden = "hidden"
    score_only = "score-only"
    full = "full"


result_visibility_enum = Enum(
    ResultVisibility,
    values_callable=lambda enum_class: [item.value for item in enum_class],
)


class QuestionDifficulty(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class QuestionType(str, enum.Enum):
    MCQ = "MCQ"
    essay = "essay"


class QuestionStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    school_id: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    #username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Optional[UserRole]] = mapped_column(Enum(UserRole))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        server_default=text("CURRENT_TIMESTAMP"),
        server_onupdate=text("CURRENT_TIMESTAMP"),
    )

    classes_taught: Mapped[list["CourseClass"]] = relationship(back_populates="teacher")
    questions_created: Mapped[list["Question"]] = relationship(back_populates="creator")
    attempts: Mapped[list["Attempt"]] = relationship(back_populates="student")
    managed_exams: Mapped[list["Exam"]] = relationship(
        back_populates="manager",
        foreign_keys="Exam.manage_by",
    )
    student_exams: Mapped[list["StudentExam"]] = relationship(
        back_populates="student",
        foreign_keys="StudentExam.student_id",
    )
class Subject(Base):
    __tablename__ = "subject"

    subject_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    subject_name: Mapped[str] = mapped_column(String(100), nullable=False)
    subject_description: Mapped[str] = mapped_column(String(255), nullable=False)

    chapters: Mapped[list["Chapter"]] = relationship(back_populates="subject")
    classes: Mapped[list["CourseClass"]] = relationship(back_populates="subject")
    exams: Mapped[list["Exam"]] = relationship(back_populates="subject")


class Chapter(Base):
    __tablename__ = "chapter"

    chapter_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chapter_name: Mapped[str] = mapped_column(String(100), nullable=False)
    chapter_description: Mapped[str] = mapped_column(String(255), nullable=False)
    subject_id: Mapped[Optional[str]] = mapped_column(
        String(20), ForeignKey("subject.subject_id", ondelete="CASCADE")
    )

    subject: Mapped[Optional["Subject"]] = relationship(back_populates="chapters")
    questions: Mapped[list["Question"]] = relationship(back_populates="chapter")
    chapter_los: Mapped[list["ChapterLO"]] = relationship(back_populates="chapter")


class LO(Base):
    __tablename__ = "lo"

    lo_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lo_name: Mapped[str] = mapped_column(String(100), nullable=False)
    lo_description: Mapped[str] = mapped_column(String(255), nullable=False)

    chapter_los: Mapped[list["ChapterLO"]] = relationship(back_populates="lo")
    lo_questions: Mapped[list["LOQuestion"]] = relationship(back_populates="lo")


class ChapterLO(Base):
    __tablename__ = "chapter_lo"

    chapter_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("chapter.chapter_id", ondelete="CASCADE"), primary_key=True
    )
    lo_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lo.lo_id", ondelete="CASCADE"), primary_key=True
    )

    chapter: Mapped["Chapter"] = relationship(back_populates="chapter_los")
    lo: Mapped["LO"] = relationship(back_populates="chapter_los")


class CourseClass(Base):
    __tablename__ = "class"

    class_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_name: Mapped[str] = mapped_column(String(100), nullable=False)
    subject_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("subject.subject_id"), nullable=False
    )
    teacher_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id"), nullable=False
    )

    subject: Mapped["Subject"] = relationship(back_populates="classes")
    teacher: Mapped["User"] = relationship(back_populates="classes_taught")
    student_classes: Mapped[list["StudentClass"]] = relationship(back_populates="course_class")


class StudentClass(Base):
    __tablename__ = "student_class"

    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id"), primary_key=True
    )
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("class.class_id"), primary_key=True
    )

    student: Mapped["User"] = relationship(foreign_keys=[student_id])
    course_class: Mapped["CourseClass"] = relationship(back_populates="student_classes")


class Question(Base):
    __tablename__ = "question"

    question_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_text: Mapped[str] = mapped_column(String(255), nullable=False)
    question_difficulties: Mapped[QuestionDifficulty] = mapped_column(
        Enum(QuestionDifficulty), nullable=False
    )
    question_type: Mapped[Optional[QuestionType]] = mapped_column(Enum(QuestionType))
    chapter_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("chapter.chapter_id", ondelete="CASCADE")
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("user.id", ondelete="SET NULL")
    )
    question_status: Mapped[Optional[QuestionStatus]] = mapped_column(Enum(QuestionStatus))

    chapter: Mapped[Optional["Chapter"]] = relationship(back_populates="questions")
    creator: Mapped[Optional["User"]] = relationship(back_populates="questions_created")
    options: Mapped[list["Option"]] = relationship(back_populates="question")
    lo_questions: Mapped[list["LOQuestion"]] = relationship(back_populates="question")
    exam_questions: Mapped[list["ExamQuestion"]] = relationship(back_populates="question")
    attempt_questions: Mapped[list["AttemptQuestion"]] = relationship(
        back_populates="question"
    )


class Option(Base):
    __tablename__ = "options"

    options_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("question.question_id", ondelete="CASCADE")
    )
    options_text: Mapped[str] = mapped_column(String(255), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    question: Mapped[Optional["Question"]] = relationship(back_populates="options")
    mcq_answers: Mapped[list["MCQAnswer"]] = relationship(back_populates="selected_option")


class LOQuestion(Base):
    __tablename__ = "lo_question"

    lo_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lo.lo_id", ondelete="CASCADE"), primary_key=True
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("question.question_id", ondelete="CASCADE"), primary_key=True
    )

    lo: Mapped["LO"] = relationship(back_populates="lo_questions")
    question: Mapped["Question"] = relationship(back_populates="lo_questions")


class Exam(Base):
    __tablename__ = "exam"

    exam_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    manage_by: Mapped[Optional[str]] = mapped_column(
        String(30), ForeignKey("user.school_id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    examcode: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    max_attempt: Mapped[Optional[int]] = mapped_column(Integer)
    description: Mapped[Optional[str]] = mapped_column(Text)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, default=90)
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    result_visibility: Mapped[Optional[ResultVisibility]] = mapped_column(
        result_visibility_enum, default=ResultVisibility.full
    )
    subject_id: Mapped[Optional[str]] = mapped_column(
        String(20), ForeignKey("subject.subject_id")
    )

    manager: Mapped[Optional["User"]] = relationship(
        back_populates="managed_exams",
        foreign_keys=[manage_by],
    )
    subject: Mapped[Optional["Subject"]] = relationship(back_populates="exams")
    exam_questions: Mapped[list["ExamQuestion"]] = relationship(back_populates="exam")
    student_exams: Mapped[list["StudentExam"]] = relationship(back_populates="exam")
    attempts: Mapped[list["Attempt"]] = relationship(back_populates="exam")


class ExamQuestion(Base):
    __tablename__ = "exam_question"

    exam_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam.exam_id", ondelete="CASCADE"), primary_key=True
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("question.question_id", ondelete="CASCADE"), primary_key=True
    )
    question_point: Mapped[int] = mapped_column(Integer, nullable=False)

    exam: Mapped["Exam"] = relationship(back_populates="exam_questions")
    question: Mapped["Question"] = relationship(back_populates="exam_questions")


class StudentExam(Base):
    __tablename__ = "student_exam"

    student_id: Mapped[str] = mapped_column(
        String(30), ForeignKey("user.school_id", ondelete="CASCADE"), primary_key=True
    )
    exam_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam.exam_id", ondelete="CASCADE"), primary_key=True
    )

    student: Mapped["User"] = relationship(
        back_populates="student_exams",
        foreign_keys=[student_id],
    )
    exam: Mapped["Exam"] = relationship(back_populates="student_exams")


class Attempt(Base):
    __tablename__ = "attempt"

    attempt_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("exam.exam_id"))
    student_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user.id"))
    attempt_no: Mapped[Optional[int]] = mapped_column(Integer)
    score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    exam: Mapped[Optional["Exam"]] = relationship(back_populates="attempts")
    student: Mapped[Optional["User"]] = relationship(back_populates="attempts")
    attempt_questions: Mapped[list["AttemptQuestion"]] = relationship(
        back_populates="attempt"
    )
    exam_events: Mapped[list["ExamEvent"]] = relationship(back_populates="attempt")


class AttemptQuestion(Base):
    __tablename__ = "attempt_question"

    attempt_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("attempt.attempt_id"), primary_key=True
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("question.question_id"), primary_key=True
    )
    display_order: Mapped[Optional[int]] = mapped_column(Integer)

    attempt: Mapped["Attempt"] = relationship(back_populates="attempt_questions")
    question: Mapped["Question"] = relationship(back_populates="attempt_questions")
    mcq_answer: Mapped[Optional["MCQAnswer"]] = relationship(
        back_populates="attempt_question", uselist=False
    )
    essay_answer: Mapped[Optional["EssayAnswer"]] = relationship(
        back_populates="attempt_question", uselist=False
    )


class MCQAnswer(Base):
    __tablename__ = "mcq_answers"
    __table_args__ = (
        ForeignKeyConstraint(
            ["attempt_id", "question_id"],
            ["attempt_question.attempt_id", "attempt_question.question_id"],
        ),
    )

    mcq_answer_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    attempt_id: Mapped[Optional[int]] = mapped_column(Integer)
    question_id: Mapped[Optional[int]] = mapped_column(Integer)
    selected_option_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("options.options_id")
    )

    attempt_question: Mapped[Optional["AttemptQuestion"]] = relationship(
        back_populates="mcq_answer",
        foreign_keys=[attempt_id, question_id],
    )
    selected_option: Mapped[Optional["Option"]] = relationship(
        back_populates="mcq_answers"
    )


class EssayAnswer(Base):
    __tablename__ = "essay_answers"
    __table_args__ = (
        ForeignKeyConstraint(
            ["attempt_id", "question_id"],
            ["attempt_question.attempt_id", "attempt_question.question_id"],
        ),
        UniqueConstraint("attempt_id", "question_id"),
    )

    essay_answer_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    attempt_id: Mapped[Optional[int]] = mapped_column(Integer)
    question_id: Mapped[Optional[int]] = mapped_column(Integer)
    answer_text: Mapped[Optional[str]] = mapped_column(Text)
    score: Mapped[Optional[int]] = mapped_column(Integer)

    attempt_question: Mapped[Optional["AttemptQuestion"]] = relationship(
        back_populates="essay_answer",
        foreign_keys=[attempt_id, question_id],
    )


class ExamEvent(Base):
    __tablename__ = "exam_event"

    event_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attempt_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("attempt.attempt_id")
    )
    event_type: Mapped[Optional[str]] = mapped_column(String(50))
    event_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime)
    details: Mapped[Optional[str]] = mapped_column(Text)

    attempt: Mapped[Optional["Attempt"]] = relationship(back_populates="exam_events")
