"""Verify the minimum disposable account pool for a Railway load-test run.

This script is intentionally read-only. It prints aggregate counts only and
does not disclose credentials, email addresses, or normal user information.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from src.a_db_config import Exam, StudentExam, Subject, TeacherSubject, User, UserRole


LOAD_SUBJECT_ID = "LOAD101"
LOAD_EXAM_TITLE = "Disposable authenticated load exam"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read-only Railway load-test seed verification")
    parser.add_argument("--students", type=int, default=150)
    parser.add_argument("--teachers", type=int, default=75)
    parser.add_argument("--admins", type=int, default=25)
    args = parser.parse_args()
    if min(args.students, args.teachers, args.admins) <= 0:
        parser.error("all required account counts must be positive")
    return args


def count_role(db, role: UserRole) -> int:
    return db.query(User).filter(
        User.school_id.like("LOAD_%"),
        User.role == role,
    ).count()


def main() -> int:
    required = parse_args()
    db = SessionLocal()
    try:
        subject = db.get(Subject, LOAD_SUBJECT_ID)
        exams = [] if subject is None else db.query(Exam).filter(
            Exam.subject_id == LOAD_SUBJECT_ID,
            Exam.title == LOAD_EXAM_TITLE,
        ).all()
        exam = exams[0] if len(exams) == 1 else None
        assignments = 0 if exam is None else db.query(StudentExam).filter(
            StudentExam.exam_id == exam.exam_id,
            StudentExam.student_id.like("LOAD_STUDENT_%"),
        ).count()
        teacher_permissions = db.query(TeacherSubject).filter(
            TeacherSubject.subject_id == LOAD_SUBJECT_ID,
            TeacherSubject.teacher_id.like("LOAD_TEACHER_%"),
            TeacherSubject.is_active.is_(True),
        ).count()
        observed = {
            "students": count_role(db, UserRole.student),
            "teachers": count_role(db, UserRole.teacher),
            "admins": count_role(db, UserRole.admin),
            "student_assignments": assignments,
            "active_teacher_permissions": teacher_permissions,
            "matching_exams": len(exams),
        }
        print(observed)
        checks = (
            observed["students"] >= required.students,
            observed["teachers"] >= required.teachers,
            observed["admins"] >= required.admins,
            observed["student_assignments"] >= required.students,
            observed["active_teacher_permissions"] >= required.teachers,
            observed["matching_exams"] == 1,
        )
        return 0 if all(checks) else 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
