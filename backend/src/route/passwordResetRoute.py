"""Forgot-password endpoints: request a code, verify it, set a new password.

Mounted under /api/auth alongside login and register. None of these require a
bearer token - the caller is by definition someone who cannot sign in.
"""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from src.service import rate_limit_service
from src.service.email_service import send_password_reset_otp
from src.service.password_reset_service import (
    GENERIC_REQUEST_MESSAGE,
    MAX_VERIFY_ATTEMPTS,
    OTP_TTL,
    PasswordResetError,
    request_otp,
    reset_password,
    verify_otp,
)


router = APIRouter()
logger = logging.getLogger("oes.password_reset")

# The outer guard, covering addresses that are not registered and so leave no
# row to count. Registered addresses are additionally throttled against their
# own rows inside password_reset_service.
REQUESTS_PER_EMAIL = 5
REQUESTS_PER_EMAIL_WINDOW = 15 * 60
REQUESTS_PER_IP = 20
REQUESTS_PER_IP_WINDOW = 15 * 60
VERIFY_PER_IP = 30
VERIFY_PER_IP_WINDOW = 15 * 60
RESET_PER_IP = 10
RESET_PER_IP_WINDOW = 15 * 60


def _limit(name: str, default: int) -> int:
    return max(1, int(os.getenv(name, str(default))))


def _check_limit(scope: str, subject: str, limit: int, window: int) -> bool:
    """Authentication recovery fails closed if shared Redis is unavailable."""
    try:
        return rate_limit_service.check(scope, subject, limit, window)
    except rate_limit_service.RateLimitUnavailable as exc:
        raise HTTPException(status_code=503, detail="Authentication temporarily unavailable") from exc


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str


class ResetPasswordRequest(BaseModel):
    resetToken: str
    newPassword: str


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _deliver(email: str, full_name: str, otp: str) -> None:
    """Send the code outside the request.

    Two reasons this is a background task. A slow or unreachable mail server
    must not hold the response open; and the response time must not depend on
    whether an address was registered, which is exactly what waiting for an SMTP
    round trip would reveal.
    """
    try:
        send_password_reset_otp(email, full_name, otp, int(OTP_TTL.total_seconds() // 60))
    except Exception:
        # Logged without the address or the code. The caller already has the
        # generic response; there is nothing safe left to tell them.
        logger.exception("password reset email could not be delivered")


@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db),
):
    """Start a reset. Always answers the same way, registered or not."""
    email = (request.email or "").strip().lower()
    ip = _client_ip(http_request)

    # Being over the limit returns the same body as success, for the same reason
    # everything else here does: a distinguishable answer is an oracle.
    within_limits = _check_limit(
        "forgot:ip", ip, _limit("AUTH_FORGOT_IP_LIMIT", REQUESTS_PER_IP), _limit("AUTH_FORGOT_IP_WINDOW", REQUESTS_PER_IP_WINDOW)
    ) and _check_limit(
        "forgot:email", email or "empty", _limit("AUTH_FORGOT_EMAIL_LIMIT", REQUESTS_PER_EMAIL), _limit("AUTH_FORGOT_EMAIL_WINDOW", REQUESTS_PER_EMAIL_WINDOW)
    )

    if within_limits and email:
        try:
            issued = request_otp(db, email)
        except Exception:
            logger.exception("password reset request failed")
            issued = None
        if issued:
            background_tasks.add_task(_deliver, issued.email, issued.full_name, issued.otp)

    return {"success": True, "message": GENERIC_REQUEST_MESSAGE}


@router.post("/verify-otp")
def verify_otp_endpoint(
    request: VerifyOtpRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    """Exchange a correct code for a short-lived reset token."""
    if not _check_limit(
        "verify:ip", _client_ip(http_request), _limit("AUTH_VERIFY_IP_LIMIT", VERIFY_PER_IP), _limit("AUTH_VERIFY_IP_WINDOW", VERIFY_PER_IP_WINDOW)
    ):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    try:
        token, expires_at = verify_otp(db, request.email, request.otp)
    except PasswordResetError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))

    return {
        "success": True,
        "resetToken": token,
        "expiresAt": expires_at.isoformat(),
        "maxAttempts": MAX_VERIFY_ATTEMPTS,
    }


@router.post("/reset-password")
def reset_password_endpoint(
    request: ResetPasswordRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    """Set the new password, then retire the token."""
    if not _check_limit(
        "reset:ip", _client_ip(http_request), _limit("AUTH_RESET_IP_LIMIT", RESET_PER_IP), _limit("AUTH_RESET_IP_WINDOW", RESET_PER_IP_WINDOW)
    ):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    try:
        reset_password(db, request.resetToken, request.newPassword)
    except PasswordResetError as error:
        issues = getattr(error, "issues", None)
        raise HTTPException(
            status_code=error.status_code,
            detail={"message": str(error), "issues": issues} if issues else str(error),
        )

    return {"success": True, "message": "Your password has been reset. You can sign in now."}
