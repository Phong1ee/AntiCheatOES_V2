"""Append fresh disposable Student accounts to the staging load-test exam.

This script is intentionally narrow: it never deletes data and it only adds
the named ``LOAD_STUDENT_*`` accounts to the existing ``LOAD101`` disposable
exam. It is safe to rerun because existing users and assignments are skipped.
"""

import argparse
import os
import sys
from pathlib import Path

from werkzeug.security import generate_password_hash

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from src.a_db_config import Exam, StudentExam, Subject, User, UserRole


PASSWORD_ENV = "LOADTEST_PASSWORD"
FIRST_STUDENT_INDEX = 501
LAST_STUDENT_INDEX = 1100
LOAD_SUBJECT_ID = "LOAD101"
LOAD_EXAM_TITLE = "Disposable authenticated load exam"


def _student(index: int, password_hash: str) -> User:
    school_id = f"LOAD_STUDENT_{index:04d}"
    return User(
        school_id=school_id,
        full_name=school_id.replace("_", " ").title(),
        email=f"load.student.{index:04d}@example.test",
        password_hash=password_hash,
        role=UserRole.student,
    )


def _parse_args() -> tuple[int, int]:
    parser = argparse.ArgumentParser(description="Append a range of disposable load-test Students")
    parser.add_argument("--first", type=int, default=FIRST_STUDENT_INDEX)
    parser.add_argument("--last", type=int, default=LAST_STUDENT_INDEX)
    args = parser.parse_args()
    if args.first < 1 or args.last < args.first:
        parser.error("--first must be positive and --last must not precede --first")
    return args.first, args.last


def main() -> None:
    first_student_index, last_student_index = _parse_args()
    db = SessionLocal()
    try:
        subject = db.get(Subject, LOAD_SUBJECT_ID)
        if subject is None:
            raise RuntimeError(f"Disposable subject {LOAD_SUBJECT_ID!r} was not found")

        exams = (
            db.query(Exam)
            .filter(Exam.subject_id == LOAD_SUBJECT_ID, Exam.title == LOAD_EXAM_TITLE)
            .all()
        )
        if len(exams) != 1:
            raise RuntimeError(
                "Expected exactly one disposable load exam for LOAD101; "
                f"found {len(exams)}"
            )
        exam = exams[0]

        requested_ids = [
            f"LOAD_STUDENT_{index:04d}"
            for index in range(first_student_index, last_student_index + 1)
        ]
        existing_students = {
            user.school_id: user
            for user in db.query(User).filter(User.school_id.in_(requested_ids)).all()
        }
        invalid_roles = [
            school_id for school_id, user in existing_students.items()
            if user.role != UserRole.student
        ]
        if invalid_roles:
            raise RuntimeError(f"Expected Student role for existing load identities: {', '.join(invalid_roles)}")

        missing_ids = [school_id for school_id in requested_ids if school_id not in existing_students]
        missing_id_set = set(missing_ids)
        if missing_ids:
            password = os.getenv(PASSWORD_ENV)
            if not password:
                raise RuntimeError(f"{PASSWORD_ENV} is required to create new load-test students")
            password_hash = generate_password_hash(password)
            db.add_all(
                _student(index, password_hash)
                for index in range(first_student_index, last_student_index + 1)
                if f"LOAD_STUDENT_{index:04d}" in missing_id_set
            )
            db.flush()

        assigned_ids = {
            student_id for (student_id,) in db.query(StudentExam.student_id).filter(
                StudentExam.exam_id == exam.exam_id,
                StudentExam.student_id.in_(requested_ids),
            ).all()
        }
        new_assignments = [
            StudentExam(student_id=school_id, exam_id=exam.exam_id)
            for school_id in requested_ids if school_id not in assigned_ids
        ]
        if new_assignments:
            db.add_all(new_assignments)
        db.commit()
        print(
            f"Disposable load seed complete for Students {first_student_index:04d}-{last_student_index:04d}: "
            f"created {len(missing_ids)} Students and "
            f"added {len(new_assignments)} assignments for exam_id={exam.exam_id}."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
