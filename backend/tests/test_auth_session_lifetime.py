from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import jwt

from src.middleware.authMiddleware import verify_token
from src.middleware.constant import ALGORITHM, SECRET_KEY


def test_verify_token_closes_identity_session_before_returning_context():
    """Auth lookup must not retain a SQLAlchemy checkout for legacy handlers."""
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
        id=7,
        school_id="S000007",
        role="student",
        deleted_at=None,
        is_locked=False,
    )
    token = jwt.encode({"sub": "S000007"}, SECRET_KEY, algorithm=ALGORITHM)

    with patch("src.middleware.authMiddleware.SessionLocal", return_value=session):
        identity = verify_token(authorization=f"Bearer {token}")

    assert identity == {"id": 7, "school_id": "S000007", "role": "student", "exp": None}
    session.close.assert_called_once_with()
