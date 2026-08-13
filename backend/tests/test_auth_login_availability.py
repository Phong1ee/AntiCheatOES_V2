import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from mysql.connector.errors import PoolError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.route.authRoute import LoginRequest, login


def test_login_reports_pool_exhaustion_as_service_unavailable():
    """A credential-store capacity fault must not be misreported as a 401."""
    with patch("src.route.authRoute.AuthController.login", side_effect=PoolError("pool exhausted")):
        with pytest.raises(HTTPException) as exc_info:
            login(LoginRequest(email="load.student.0001@example.test", password="not-logged"))

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Authentication temporarily unavailable"
