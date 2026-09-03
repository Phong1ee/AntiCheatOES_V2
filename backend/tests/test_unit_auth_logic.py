from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi import HTTPException

from src.controller.authController import AuthController
from src.middleware.authMiddleware import RoleChecker, verify_token
from src.middleware.constant import ALGORITHM, SECRET_KEY


def _token(payload: dict) -> str:
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _identity(*, deleted_at=None, is_locked=False, role="student") -> SimpleNamespace:
    return SimpleNamespace(
        id=7,
        school_id="STU-UNIT-001",
        role=role,
        deleted_at=deleted_at,
        is_locked=is_locked,
    )


def test_normalize_role_accepts_known_values_and_rejects_unknown_values():
    assert AuthController.normalize_role(" Teacher ") == "teacher"
    with pytest.raises(Exception, match="Role must be one of"):
        AuthController.normalize_role("observer")


@pytest.mark.parametrize("authorization", [None, "Basic abc", "Bearer", "Bearer first second"])
def test_verify_token_rejects_missing_or_malformed_authorization_header(authorization):
    with pytest.raises(HTTPException) as raised:
        verify_token(authorization=authorization)

    assert raised.value.status_code == 401


def test_verify_token_rejects_an_expired_token_without_opening_a_database_session():
    expired = _token({
        "sub": "STU-UNIT-001",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
    })
    with patch("src.middleware.authMiddleware.SessionLocal") as session_factory:
        with pytest.raises(HTTPException) as raised:
            verify_token(authorization=f"Bearer {expired}")

    assert raised.value.status_code == 401
    assert raised.value.detail == "Token has expired"
    session_factory.assert_not_called()


@pytest.mark.parametrize(
    "identity",
    [None, _identity(deleted_at=datetime(2026, 9, 3)), _identity(is_locked=True)],
    ids=["missing", "deleted", "locked"],
)
def test_verify_token_rejects_unavailable_accounts_after_token_decoding(identity):
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = identity
    token = _token({"sub": "STU-UNIT-001"})

    with patch("src.middleware.authMiddleware.SessionLocal", return_value=session):
        with pytest.raises(HTTPException) as raised:
            verify_token(authorization=f"Bearer {token}")

    assert raised.value.status_code == 401
    assert raised.value.detail == "Account is unavailable"
    session.close.assert_called_once_with()


def test_role_checker_compares_roles_case_insensitively_and_denies_other_roles():
    checker = RoleChecker(["teacher"])

    assert checker({"role": "TEACHER"}) == {"role": "TEACHER"}
    with pytest.raises(HTTPException) as raised:
        checker({"role": "student"})

    assert raised.value.status_code == 403
