import os
import subprocess
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _import_constants(secret_key: str | None) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    if secret_key is None:
        environment.pop("SECRET_KEY", None)
    else:
        environment["SECRET_KEY"] = secret_key
    return subprocess.run(
        [sys.executable, "-c", "import src.middleware.constant"],
        cwd=BACKEND_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


def test_jwt_secret_fails_fast_when_missing_or_placeholder():
    for secret in (None, "mysecretkey", "replace-with-a-long-random-secret"):
        result = _import_constants(secret)
        assert result.returncode != 0
        assert "SECRET_KEY must be" in result.stderr


def test_jwt_secret_accepts_a_sufficiently_long_runtime_value():
    result = _import_constants("a" * 32)
    assert result.returncode == 0, result.stderr


def test_production_database_configuration_fails_fast_when_missing():
    environment = os.environ.copy()
    environment.update({
        "APP_ENV": "production",
        "SECRET_KEY": "a" * 32,
        "DB_HOST": "",
        "DB_NAME": "",
        "DB_USER": "",
        "DB_PASSWORD": "",
    })
    result = subprocess.run(
        [sys.executable, "-c", "import database"],
        cwd=BACKEND_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "production requires database configuration" in result.stderr


def test_committed_environment_template_contains_no_smtp_credentials():
    values = {}
    for line in (BACKEND_ROOT / ".env.example").read_text(encoding="utf-8").splitlines():
        if line.startswith("SMTP_") and "=" in line:
            key, value = line.split("=", 1)
            values[key] = value
    assert values["SMTP_HOST"] == ""
    assert values["SMTP_USERNAME"] == ""
    assert values["SMTP_PASSWORD"] == ""
    assert values["SMTP_FROM"] == ""
