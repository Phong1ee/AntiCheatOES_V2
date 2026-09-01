"""Focused tests for the HTTPS mail-provider fallback used by password reset."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

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
