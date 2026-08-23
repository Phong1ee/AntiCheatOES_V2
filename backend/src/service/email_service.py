"""Outgoing email over SMTP.

Uses the standard library only - smtplib and email.message - so no dependency
is added for one feature. Configuration is read from the environment the same
way the rest of the backend reads it.

Settings are read from the environment first - backend/.env, loaded at startup -
and fall back to the SMTP_* block of backend/.env.example, which is committed so
the team shares one mail configuration without each person copying it. A local
.env therefore overrides the shared file rather than competing with it.

Note that .env.example is tracked by git: whatever sits in its SMTP_PASSWORD is
published with the repository.

When SMTP is not configured the sender falls back to writing the message to the
application log instead of failing. That keeps a development checkout working
without a mail server; it is refused outright when APP_ENV is production, where
silently not sending a password-reset code would be worse than an error.
"""

from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from functools import lru_cache
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]


@lru_cache(maxsize=1)
def _shared_settings() -> dict[str, str]:
    """SMTP_* values from backend/.env.example, the team's shared config.

    Read directly rather than through load_dotenv so this cannot reach any
    other setting: only SMTP_* keys are taken, so a placeholder like
    DB_USER=your_db_user in the template can never shadow a real one.

    Parsed once per process, so editing the file needs a restart - the same as
    .env. A value in the real environment always wins over this.
    """
    settings: dict[str, str] = {}
    path = BACKEND_ROOT / ".env.example"
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line.startswith("SMTP_") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            settings[key.strip()] = value.strip()
    except OSError:
        pass
    return settings


# A plain logger, not observability_service.log_event: that helper drops any
# field outside its allowlist, and the development fallback below has to print
# the message body for the code to be usable at all.
logger = logging.getLogger("oes.email")


def _env(name: str, default: str = "") -> str:
    """A setting, preferring the environment and falling back to the template.

    The order matters: backend/.env (loaded into the environment at startup)
    overrides the shared file, so anyone can point their own checkout at a
    different mailbox without touching what the team shares.
    """
    value = os.getenv(name) or _shared_settings().get(name) or default
    return value.strip()


def _is_production() -> bool:
    return _env("APP_ENV", "development").lower() == "production"


def smtp_is_configured() -> bool:
    return bool(_env("SMTP_HOST"))


class EmailNotConfigured(RuntimeError):
    """Raised when production is asked to send mail without an SMTP server."""


def send_email(to_address: str, subject: str, body: str) -> None:
    """Deliver one plain-text message.

    Raises on delivery failure so the caller can log it. Callers on a request
    path should send through a background task: an unreachable mail server must
    not hold the HTTP response open.
    """
    if not smtp_is_configured():
        if _is_production():
            raise EmailNotConfigured(
                "SMTP_HOST is not set; refusing to drop an email in production"
            )
        # Development fallback. The body carries the code, which is exactly why
        # this branch is unreachable in production.
        logger.warning(
            "SMTP is not configured - the email below was NOT sent. To=%s Subject=%s Body=%r",
            to_address,
            subject,
            body,
        )
        return

    host = _env("SMTP_HOST")
    port = int(_env("SMTP_PORT", "587") or "587")
    username = _env("SMTP_USERNAME")
    # Google displays app passwords grouped as "abcd efgh ijkl mnop". The spaces
    # are presentation only - sending them gives a 535, which reads like a wrong
    # password rather than a formatting problem.
    password = "".join(_env("SMTP_PASSWORD").split())
    sender = _env("SMTP_FROM") or username or "no-reply@localhost"
    use_ssl = _env("SMTP_USE_SSL", "false").lower() in {"1", "true", "yes", "on"}
    use_starttls = _env("SMTP_USE_STARTTLS", "true").lower() in {"1", "true", "yes", "on"}
    timeout = float(_env("SMTP_TIMEOUT", "10") or "10")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = to_address
    message["Subject"] = subject
    message.set_content(body)

    if use_ssl:
        client = smtplib.SMTP_SSL(host, port, timeout=timeout)
    else:
        client = smtplib.SMTP(host, port, timeout=timeout)
    try:
        if use_starttls and not use_ssl:
            client.starttls()
        if username:
            client.login(username, password)
        client.send_message(message)
    finally:
        client.quit()


def send_password_reset_otp(to_address: str, full_name: str, otp: str, valid_minutes: int) -> None:
    """Send one password-reset code."""
    greeting = full_name.strip() or "there"
    lines = [
        f"Hi {greeting},",
        "",
        f"Your password reset code is: {otp}",
        "",
        f"It is valid for {valid_minutes} minutes and can be used once.",
        "",
        "If you did not ask to reset your password you can ignore this email -",
        "your password has not changed.",
        "",
    ]
    send_email(to_address, "Your OES password reset code", "\n".join(lines))
