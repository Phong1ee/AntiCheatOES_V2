"""Synchronize the controlled Teacher and Admin load-test credentials.

The role pools are deliberately shared by the Locust read-only workload. This
script updates only the seven named disposable accounts and never affects
normal application users or Student accounts.
"""

import os
import sys
from pathlib import Path

from werkzeug.security import generate_password_hash

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from src.a_db_config import User, UserRole


PASSWORD_ENV = "LOADTEST_PASSWORD"
EXPECTED_ROLES = {
    **{f"LOAD_ADMIN_{index:03d}": UserRole.admin for index in range(1, 3)},
    **{f"LOAD_TEACHER_{index:03d}": UserRole.teacher for index in range(1, 6)},
}


def main() -> None:
    password = os.getenv(PASSWORD_ENV)
    if not password:
        raise RuntimeError(f"{PASSWORD_ENV} is required to synchronize disposable credentials")

    db = SessionLocal()
    try:
        users = {
            user.school_id: user
            for user in db.query(User).filter(User.school_id.in_(EXPECTED_ROLES)).all()
        }
        missing_ids = sorted(set(EXPECTED_ROLES) - set(users))
        if missing_ids:
            raise RuntimeError(f"Expected disposable role accounts were not found: {', '.join(missing_ids)}")
        invalid_roles = sorted(
            school_id for school_id, expected_role in EXPECTED_ROLES.items()
            if users[school_id].role != expected_role
        )
        if invalid_roles:
            raise RuntimeError(f"Unexpected role for disposable accounts: {', '.join(invalid_roles)}")

        password_hash = generate_password_hash(password)
        for user in users.values():
            user.password_hash = password_hash
        db.commit()
        print(f"Synchronized credentials for {len(users)} disposable Admin/Teacher accounts.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
