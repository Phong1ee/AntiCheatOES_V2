"""Focused tests for the HTTPS mail-provider fallback used by password reset."""

from __future__ import annotations

from io import BytesIO
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from src.service import email_service


def test_resend_is_preferred_when_its_required_settings_exist(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("RESEND_FROM", "OES <no-reply@example.com>")
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")

    response = MagicMock()
    response.read.return_value = b'{"id":"email-id"}'
    with patch("src.service.email_service.urlopen", return_value=response) as send:
        email_service.send_email("student@example.com", "Reset", "Your code")

    request = send.call_args.args[0]
    assert request.full_url == "https://api.resend.com/emails"
    assert request.get_method() == "POST"
    assert b'"to": ["student@example.com"]' in request.data


def test_resend_requires_both_key_and_sender(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.delenv("RESEND_FROM", raising=False)

    assert not email_service.resend_is_configured()


def test_brevo_is_preferred_with_a_verified_sender(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test-key")
    monkeypatch.setenv("BREVO_SENDER_EMAIL", "anticheatoes.noreply@gmail.com")
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("RESEND_FROM", "OES <no-reply@example.com>")

    response = MagicMock()
    response.read.return_value = b'{"messageId":"email-id"}'
    with patch("src.service.email_service.urlopen", return_value=response) as send:
        email_service.send_email("student@example.com", "Reset", "Your code")

    request = send.call_args.args[0]
    assert request.full_url == "https://api.brevo.com/v3/smtp/email"
    assert b'"email": "anticheatoes.noreply@gmail.com"' in request.data


def test_brevo_requires_key_and_sender(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test-key")
    monkeypatch.delenv("BREVO_SENDER_EMAIL", raising=False)

    assert not email_service.brevo_is_configured()


def test_gmail_api_is_preferred_when_oauth_settings_exist(monkeypatch):
    monkeypatch.setenv("GOOGLE_GMAIL_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_GMAIL_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("GOOGLE_GMAIL_REFRESH_TOKEN", "refresh-token")
    monkeypatch.setenv("GOOGLE_GMAIL_SENDER", "anticheatoes.noreply@gmail.com")
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test-key")
    monkeypatch.setenv("BREVO_SENDER_EMAIL", "sender@example.com")

    response = MagicMock()
    response.read.side_effect = [b'{"access_token":"access-token"}', b'{"id":"message-id"}']
    with patch("src.service.email_service.urlopen", return_value=response) as send:
        email_service.send_email("student@example.com", "Reset", "Your code")

    token_request, gmail_request = [call.args[0] for call in send.call_args_list]
    assert token_request.full_url == "https://oauth2.googleapis.com/token"
    assert gmail_request.full_url == "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    assert gmail_request.get_header("Authorization") == "Bearer access-token"


def test_gmail_api_requires_all_oauth_settings(monkeypatch):
    monkeypatch.setenv("GOOGLE_GMAIL_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_GMAIL_CLIENT_SECRET", "client-secret")
    monkeypatch.delenv("GOOGLE_GMAIL_REFRESH_TOKEN", raising=False)
    monkeypatch.setenv("GOOGLE_GMAIL_SENDER", "anticheatoes.noreply@gmail.com")

    assert not email_service.gmail_is_configured()


def test_provider_error_keeps_only_the_short_provider_message():
    error = HTTPError(
        "https://api.brevo.com/v3/smtp/email",
        403,
        "Forbidden",
        hdrs=None,
        fp=BytesIO(b'{"message":"Your account is not activated"}'),
    )

    assert str(email_service._provider_error("Brevo", error)) == (
        "Brevo rejected the message (HTTP 403): Your account is not activated"
    )
