"""Append disposable Teacher and Administrator accounts for load testing.

New Teachers receive only the ``LOAD101`` subject permission. The script is
idempotent and never deletes or changes normal application accounts.
"""

import argparse
import os
import sys
from pathlib import Path

from werkzeug.security import generate_password_hash

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from src.a_db_config import Subject, TeacherSubject, User, UserRole


PASSWORD_ENV = "LOADTEST_PASSWORD"
LOAD_SUBJECT_ID = "LOAD101"
ASSIGNING_ADMIN_ID = "LOAD_ADMIN_001"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Append disposable Teacher and Admin accounts")
    parser.add_argument("--teacher-first", type=int, default=6)
    parser.add_argument("--teacher-last", type=int, default=1005)
    parser.add_argument("--admin-first", type=int, default=3)
    parser.add_argument("--admin-last", type=int, default=352)
    args = parser.parse_args()
    if min(args.teacher_first, args.admin_first) < 1:
        parser.error("first indices must be positive")
    if args.teacher_last < args.teacher_first or args.admin_last < args.admin_first:
        parser.error("last indices must not precede first indices")
    return args


def _user(role: UserRole, index: int, password_hash: str) -> User:
    prefix = "TEACHER" if role == UserRole.teacher else "ADMIN"
    school_id = f"LOAD_{prefix}_{index:03d}"
    return User(
        school_id=school_id,
        full_name=school_id.replace("_", " ").title(),
        email=f"load.{role.value}.{index:03d}@example.test",
        password_hash=password_hash,
        role=role,
    )


def main() -> None:
    args = _parse_args()
    password = os.getenv(PASSWORD_ENV)
    if not password:
        raise RuntimeError(f"{PASSWORD_ENV} is required to create disposable role accounts")

    teacher_ids = [f"LOAD_TEACHER_{index:03d}" for index in range(args.teacher_first, args.teacher_last + 1)]
    admin_ids = [f"LOAD_ADMIN_{index:03d}" for index in range(args.admin_first, args.admin_last + 1)]
    requested_roles = {
        **{school_id: UserRole.teacher for school_id in teacher_ids},
        **{school_id: UserRole.admin for school_id in admin_ids},
    }

    db = SessionLocal()
    try:
        if db.get(Subject, LOAD_SUBJECT_ID) is None:
            raise RuntimeError(f"Disposable subject {LOAD_SUBJECT_ID!r} was not found")
        assigning_admin = db.query(User).filter(User.school_id == ASSIGNING_ADMIN_ID).one_or_none()
        if assigning_admin is None or assigning_admin.role != UserRole.admin:
            raise RuntimeError(f"Expected disposable assigning admin {ASSIGNING_ADMIN_ID!r} was not found")

        existing = {
            user.school_id: user
            for user in db.query(User).filter(User.school_id.in_(requested_roles)).all()
        }
        invalid_roles = sorted(
            school_id for school_id, expected_role in requested_roles.items()
            if school_id in existing and existing[school_id].role != expected_role
        )
        if invalid_roles:
            raise RuntimeError(f"Unexpected role for existing load identities: {', '.join(invalid_roles)}")

        password_hash = generate_password_hash(password)
        missing_teacher_indices = [
            index for index, school_id in zip(range(args.teacher_first, args.teacher_last + 1), teacher_ids)
            if school_id not in existing
        ]
        missing_admin_indices = [
            index for index, school_id in zip(range(args.admin_first, args.admin_last + 1), admin_ids)
            if school_id not in existing
        ]
        db.add_all(_user(UserRole.teacher, index, password_hash) for index in missing_teacher_indices)
        db.add_all(_user(UserRole.admin, index, password_hash) for index in missing_admin_indices)
        db.flush()

        permitted_teacher_ids = {
            teacher_id for (teacher_id,) in db.query(TeacherSubject.teacher_id).filter(
                TeacherSubject.subject_id == LOAD_SUBJECT_ID,
                TeacherSubject.teacher_id.in_(teacher_ids),
            ).all()
        }
        new_permissions = [
            TeacherSubject(
                teacher_id=teacher_id,
                subject_id=LOAD_SUBJECT_ID,
                assigned_by=ASSIGNING_ADMIN_ID,
                is_active=True,
            )
            for teacher_id in teacher_ids if teacher_id not in permitted_teacher_ids
        ]
        if new_permissions:
            db.add_all(new_permissions)
        db.commit()
        print(
            f"Disposable role seed complete: created {len(missing_teacher_indices)} Teachers, "
            f"{len(missing_admin_indices)} Admins, and {len(new_permissions)} LOAD101 permissions."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
