"""Synchronize credentials for every disposable Railway load-test account.

The script updates only accounts whose ``school_id`` begins with ``LOAD_`` and
whose role is a load-test role. It never affects normal application accounts.
"""

import os
import sys
from pathlib import Path

from werkzeug.security import generate_password_hash

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from src.a_db_config import User, UserRole


PASSWORD_ENV = "LOADTEST_PASSWORD"
LOADTEST_ROLES = (UserRole.student, UserRole.teacher, UserRole.admin)


def main() -> None:
    password = os.getenv(PASSWORD_ENV)
    if not password:
        raise RuntimeError(f"{PASSWORD_ENV} is required to synchronize disposable credentials")

    db = SessionLocal()
    try:
        users = db.query(User).filter(
            User.school_id.like("LOAD_%"),
            User.role.in_(LOADTEST_ROLES),
        ).all()
        if not users:
            raise RuntimeError("No disposable LOAD_* accounts were found")

        password_hash = generate_password_hash(password)
        role_counts = {role.value: 0 for role in LOADTEST_ROLES}
        for user in users:
            user.password_hash = password_hash
            role_counts[user.role.value] += 1
        db.commit()
        print(f"Synchronized credentials for {len(users)} disposable accounts: {role_counts}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
