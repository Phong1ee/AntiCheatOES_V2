"""Seed five equivalent disposable exams for the lock-diagnosis control run."""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

from werkzeug.security import generate_password_hash

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from src.a_db_config import (
    Exam,
    ExamQuestion,
    ExamSetting,
    ExamStatus,
    Option,
    Question,
    QuestionDifficulty,
    QuestionStatus,
    QuestionType,
    StudentExam,
    Subject,
    TeacherSubject,
    User,
    UserRole,
)


def _user(school_id: str, email: str, role: UserRole, password_hash: str) -> User:
    return User(school_id=school_id, full_name=school_id.replace("_", " ").title(), email=email, password_hash=password_hash, role=role)


def main() -> None:
    password = os.getenv("LOADTEST_PASSWORD")
    if not password:
        raise RuntimeError("LOADTEST_PASSWORD is required")

    db = SessionLocal()
    try:
        if db.query(User).filter(User.school_id.like("LOAD_%")).first():
            raise RuntimeError("LOAD_* accounts already exist; use a fresh disposable MySQL volume")
        password_hash = generate_password_hash(password)
        admins = [_user(f"LOAD_ADMIN_{i:03d}", f"load.admin.{i:03d}@example.test", UserRole.admin, password_hash) for i in range(1, 3)]
        teachers = [_user(f"LOAD_TEACHER_{i:03d}", f"load.teacher.{i:03d}@example.test", UserRole.teacher, password_hash) for i in range(1, 6)]
        students = [_user(f"LOAD_STUDENT_{i:04d}", f"load.student.{i:04d}@example.test", UserRole.student, password_hash) for i in range(1, 501)]
        db.add_all(admins + teachers + students)
        subject = Subject(subject_id="LOAD101", subject_name="Disposable Lock Diagnosis", subject_description="Isolated test data only")
        db.add(subject)
        db.flush()
        db.add_all(TeacherSubject(teacher_id=teacher.school_id, subject_id=subject.subject_id, assigned_by=admins[0].school_id, is_active=True) for teacher in teachers)

        now = datetime.now()
        exams: list[Exam] = []
        for exam_number in range(1, 6):
            exam = Exam(manage_by=teachers[0].school_id, title=f"Disposable lock diagnosis exam {exam_number}", max_attempt=20, duration_minutes=120, start_time=now - timedelta(hours=1), end_time=now + timedelta(days=1), status=ExamStatus.published, subject_id=subject.subject_id)
            db.add(exam)
            db.flush()
            question = Question(question_text="Which option confirms this isolated lock diagnosis seed?", question_type=QuestionType.MCQ, question_difficulties=QuestionDifficulty.easy, subject_id=subject.subject_id, created_by=teachers[0].school_id, question_status=QuestionStatus.approved)
            db.add(question)
            db.flush()
            db.add_all([Option(question_id=question.question_id, options_text="Lock diagnosis seed", is_correct=True), Option(question_id=question.question_id, options_text="Production data", is_correct=False), ExamQuestion(exam_id=exam.exam_id, question_id=question.question_id, question_point=100), ExamSetting(exam_id=exam.exam_id, anti_cheat_enabled=True, violation_limit=2)])
            exams.append(exam)
        db.add_all(StudentExam(student_id=student.school_id, exam_id=exams[(index - 1) % len(exams)].exam_id) for index, student in enumerate(students, start=1))
        db.commit()
        print("Seeded 2 Admins, 5 Teachers, 500 Students, and 5 distributed disposable exams.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
