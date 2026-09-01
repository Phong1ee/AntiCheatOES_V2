"""Outgoing email over Gmail/Brevo/Resend HTTPS or SMTP.

Uses only the standard library, so no dependency is added for one feature.
Configuration is read from the environment the same way the rest of the
backend reads it.

Settings are read from the runtime environment. The committed `.env.example`
contains placeholders only and must never act as a credential source.

When SMTP is not configured the sender falls back to writing the message to the
application log instead of failing. That keeps a development checkout working
without a mail server; it is refused outright when APP_ENV is production, where
silently not sending a password-reset code would be worse than an error.
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
import base64
from contextlib import closing
from email.message import EmailMessage
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
# A plain logger, not observability_service.log_event: that helper drops any
# field outside its allowlist, and the development fallback below has to print
# the message body for the code to be usable at all.
logger = logging.getLogger("oes.email")


def _env(name: str, default: str = "") -> str:
    """Return an SMTP setting from the runtime environment only."""
    return (os.getenv(name) or default).strip()


def _is_production() -> bool:
    return _env("APP_ENV", "development").lower() == "production"


def smtp_is_configured() -> bool:
    return bool(_env("SMTP_HOST"))


def resend_is_configured() -> bool:
    """Return whether the preferred Railway-safe HTTPS mail provider is configured."""
    return bool(_env("RESEND_API_KEY") and _env("RESEND_FROM"))


def brevo_is_configured() -> bool:
    """Return whether Brevo can send with the verified Gmail sender."""
    return bool(_env("BREVO_API_KEY") and _env("BREVO_SENDER_EMAIL"))


def gmail_is_configured() -> bool:
    """Return whether Gmail API OAuth credentials are complete at runtime."""
    names = (
        "GOOGLE_GMAIL_CLIENT_ID",
        "GOOGLE_GMAIL_CLIENT_SECRET",
        "GOOGLE_GMAIL_REFRESH_TOKEN",
        "GOOGLE_GMAIL_SENDER",
    )
    return all(_env(name) for name in names)


class EmailNotConfigured(RuntimeError):
    """Raised when production is asked to send mail without a provider."""


class EmailDeliveryError(RuntimeError):
    """Raised when an HTTPS email provider refuses or cannot accept a message."""


def _provider_error(provider: str, error: HTTPError) -> EmailDeliveryError:
    """Keep a provider's short diagnostic without exposing request credentials."""
    message = ""
    try:
        payload = json.loads(error.read().decode("utf-8", errors="replace"))
        candidate = payload.get("message") if isinstance(payload, dict) else None
        if isinstance(candidate, str):
            message = candidate.replace("\n", " ").strip()[:300]
    except (OSError, UnicodeError, ValueError):
        pass

    detail = f": {message}" if message else ""
    return EmailDeliveryError(f"{provider} rejected the message (HTTP {error.code}){detail}")


def _send_via_resend(to_address: str, subject: str, body: str) -> None:
    """Send through Resend's HTTPS API, avoiding blocked outbound SMTP ports."""
    payload = json.dumps(
        {
            "from": _env("RESEND_FROM"),
            "to": [to_address],
            "subject": subject,
            "text": body,
        }
    ).encode("utf-8")
    request = Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {_env('RESEND_API_KEY')}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        # Read the response before closing it so HTTP failures are not silently lost.
        with closing(urlopen(request, timeout=float(_env("RESEND_TIMEOUT", "10") or "10"))) as response:
            response.read()
    except HTTPError as error:
        raise _provider_error("Resend", error) from error
    except URLError as error:
        raise EmailDeliveryError("Could not reach Resend") from error


def _send_via_brevo(to_address: str, subject: str, body: str) -> None:
    """Send through Brevo's HTTPS API using its verified sender address."""
    payload = json.dumps(
        {
            "sender": {
                "email": _env("BREVO_SENDER_EMAIL"),
                "name": _env("BREVO_SENDER_NAME", "AntiCheat OES"),
            },
            "to": [{"email": to_address}],
            "subject": subject,
            "textContent": body,
        }
    ).encode("utf-8")
    request = Request(
        "https://api.brevo.com/v3/smtp/email",
        data=payload,
        headers={
            "api-key": _env("BREVO_API_KEY"),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with closing(urlopen(request, timeout=float(_env("BREVO_TIMEOUT", "10") or "10"))) as response:
            response.read()
    except HTTPError as error:
        raise _provider_error("Brevo", error) from error
    except URLError as error:
        raise EmailDeliveryError("Could not reach Brevo") from error


def _gmail_access_token() -> str:
    """Exchange the stored refresh token for a short-lived Gmail API token."""
    payload = urlencode(
        {
            "client_id": _env("GOOGLE_GMAIL_CLIENT_ID"),
            "client_secret": _env("GOOGLE_GMAIL_CLIENT_SECRET"),
            "refresh_token": _env("GOOGLE_GMAIL_REFRESH_TOKEN"),
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    request = Request(
        "https://oauth2.googleapis.com/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with closing(urlopen(request, timeout=float(_env("GOOGLE_GMAIL_TIMEOUT", "10") or "10"))) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise _provider_error("Google OAuth", error) from error
    except (URLError, UnicodeError, ValueError) as error:
        raise EmailDeliveryError("Could not obtain a Gmail API access token") from error

    token = result.get("access_token") if isinstance(result, dict) else None
    if not isinstance(token, str) or not token:
        raise EmailDeliveryError("Google OAuth did not return an access token")
    return token


def _send_via_gmail(to_address: str, subject: str, body: str) -> None:
    """Send through Gmail API over HTTPS, avoiding provider SMTP restrictions."""
    message = EmailMessage()
    message["From"] = _env("GOOGLE_GMAIL_SENDER")
    message["To"] = to_address
    message["Subject"] = subject
    message.set_content(body)
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii").rstrip("=")
    request = Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        data=json.dumps({"raw": raw_message}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {_gmail_access_token()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with closing(urlopen(request, timeout=float(_env("GOOGLE_GMAIL_TIMEOUT", "10") or "10"))) as response:
            response.read()
    except HTTPError as error:
        raise _provider_error("Gmail API", error) from error
    except URLError as error:
        raise EmailDeliveryError("Could not reach Gmail API") from error


def send_email(to_address: str, subject: str, body: str) -> None:
    """Deliver one plain-text message.

    Raises on delivery failure so the caller can log it. Callers on a request
    path should send through a background task: an unreachable mail server must
    not hold the HTTP response open.
    """
    if gmail_is_configured():
        _send_via_gmail(to_address, subject, body)
        return

    if brevo_is_configured():
        _send_via_brevo(to_address, subject, body)
        return

    if resend_is_configured():
        _send_via_resend(to_address, subject, body)
        return

    if not smtp_is_configured():
        if _is_production():
            raise EmailNotConfigured(
                "No email provider is configured; refusing to drop an email in production"
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
