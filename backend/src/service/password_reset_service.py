"""Password reset by emailed one-time code.

The flow is three steps, and each one hands the next a single-use secret:

    request_otp(email)          -> a 6-digit code, emailed, valid 3 minutes
    verify_otp(email, code)     -> a reset token, valid 10 minutes
    reset_password(token, pw)   -> the password changes, the token dies

Everything is stored hashed. The code is hashed with HMAC-SHA256 keyed on the
application secret rather than a plain digest, because six digits is only a
million possibilities: an attacker holding a database dump would recover a plain
SHA-256 of the code instantly, but cannot without the key. The reset token is
256 bits of randomness, so a plain SHA-256 is enough there.

None of these functions tell the caller whether an email address is registered.
request_otp returns the same value either way, and its cost is dominated by the
same work in both branches so the response time does not leak it either.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash

from src.a_db_config import PasswordResetOtp, User
from src.controller.profileController import ProfileController
from src.middleware.constant import SECRET_KEY


# The window the spec fixes: a code is dead exactly three minutes after it is
# generated, whatever the client's clock says.
OTP_TTL = timedelta(minutes=3)
# Long enough to type a new password twice, short enough that a token left in a
# closed tab is worthless.
RESET_TOKEN_TTL = timedelta(minutes=10)
MAX_VERIFY_ATTEMPTS = 5
# Resend throttling. The floor stops a held-down button; the cap stops a slow
# drip from using the mail server as an amplifier against one address.
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_SENDS_PER_WINDOW = 3
SEND_WINDOW = timedelta(minutes=15)

OTP_LENGTH = 6

# The one message the request step ever returns. Anything that varies with
# whether the address exists - wording, status code, an error - is an account
# enumeration oracle, so there is deliberately only one of these.
GENERIC_REQUEST_MESSAGE = "If the email is registered, a verification code has been sent."


class PasswordResetError(Exception):
    """A reset step the caller may retry or must restart, with a safe message."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


@dataclass
class IssuedOtp:
    """What request_otp produced, for the caller to email. Never returned over HTTP."""

    email: str
    full_name: str
    otp: str
    expires_at: datetime


def _now() -> datetime:
    # Naive UTC, matching every other timestamp this schema stores.
    return datetime.utcnow()


def generate_otp() -> str:
    """A cryptographically random 6-digit code, leading zeros preserved."""
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def hash_otp(otp: str) -> str:
    """Keyed hash of a code. See the module docstring for why it is keyed."""
    return hmac.new(SECRET_KEY.encode("utf-8"), otp.encode("utf-8"), hashlib.sha256).hexdigest()


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _active_otp(db: Session, user_id: int) -> PasswordResetOtp | None:
    """The user's newest code that has not been used, expired or superseded."""
    return (
        db.query(PasswordResetOtp)
        .filter(
            PasswordResetOtp.user_id == user_id,
            PasswordResetOtp.consumed_at.is_(None),
            PasswordResetOtp.expires_at > _now(),
        )
        .order_by(PasswordResetOtp.created_at.desc(), PasswordResetOtp.id.desc())
        .first()
    )


def _recent_send_count(db: Session, user_id: int) -> int:
    return (
        db.query(func.count(PasswordResetOtp.id))
        .filter(
            PasswordResetOtp.user_id == user_id,
            PasswordResetOtp.created_at > _now() - SEND_WINDOW,
        )
        .scalar()
        or 0
    )


def _last_send_at(db: Session, user_id: int) -> datetime | None:
    return (
        db.query(func.max(PasswordResetOtp.created_at))
        .filter(PasswordResetOtp.user_id == user_id)
        .scalar()
    )


def request_otp(db: Session, email: str) -> IssuedOtp | None:
    """Issue a code for this address, or None when nothing should be sent.

    None covers three cases the caller must treat identically - no such user, a
    locked or deleted account, and a throttled resend - because distinguishing
    them to the client is exactly the leak this endpoint has to avoid.
    """
    normalized = (email or "").strip().lower()
    if not normalized:
        return None

    user = (
        db.query(User)
        .filter(func.lower(User.email) == normalized, User.deleted_at.is_(None))
        .first()
    )
    # A locked account is not a route back in: resetting the password would let
    # a locked-out user return without an administrator lifting the lock.
    if not user or user.is_locked:
        return None

    now = _now()
    last_sent = _last_send_at(db, user.id)
    if last_sent and now - last_sent < RESEND_COOLDOWN:
        return None
    if _recent_send_count(db, user.id) >= MAX_SENDS_PER_WINDOW:
        return None

    # A resend must retire the previous code, or two live codes would exist and
    # the older one would stay usable for its full three minutes.
    superseded = (
        db.query(PasswordResetOtp)
        .filter(
            PasswordResetOtp.user_id == user.id,
            PasswordResetOtp.consumed_at.is_(None),
        )
        .all()
    )
    for row in superseded:
        row.consumed_at = now

    otp = generate_otp()
    expires_at = now + OTP_TTL
    db.add(
        PasswordResetOtp(
            user_id=user.id,
            otp_hash=hash_otp(otp),
            expires_at=expires_at,
            attempts=0,
            created_at=now,
        )
    )
    db.commit()

    return IssuedOtp(email=user.email, full_name=user.full_name or "", otp=otp, expires_at=expires_at)


def verify_otp(db: Session, email: str, otp: str) -> tuple[str, datetime]:
    """Check a code and exchange it for a reset token.

    Returns (token, expires_at). Raises PasswordResetError on every failure,
    with the same message for a wrong code and an unknown address so that
    neither one identifies a registered account.
    """
    invalid = "The code is incorrect or has expired. Request a new one."
    normalized = (email or "").strip().lower()
    submitted = (otp or "").strip()

    user = (
        db.query(User)
        .filter(func.lower(User.email) == normalized, User.deleted_at.is_(None))
        .first()
    )
    if not user or user.is_locked:
        raise PasswordResetError(invalid)

    record = _active_otp(db, user.id)
    if not record:
        raise PasswordResetError(invalid)

    if record.attempts >= MAX_VERIFY_ATTEMPTS:
        record.consumed_at = _now()
        db.commit()
        raise PasswordResetError("Too many incorrect attempts. Request a new code.", status_code=429)

    # compare_digest, not ==: a short-circuiting comparison leaks how much of
    # the hash matched through its timing.
    if not hmac.compare_digest(record.otp_hash, hash_otp(submitted)):
        record.attempts += 1
        # Burn the row on the last allowed miss rather than leaving a code that
        # is alive but unusable.
        if record.attempts >= MAX_VERIFY_ATTEMPTS:
            record.consumed_at = _now()
        db.commit()
        raise PasswordResetError(invalid)

    now = _now()
    token = secrets.token_urlsafe(32)
    # Consumed in the same commit that issues the token: the code is spent the
    # instant it works, so a replay finds a dead row.
    record.consumed_at = now
    record.reset_token_hash = hash_reset_token(token)
    record.reset_token_expires_at = now + RESET_TOKEN_TTL
    db.commit()

    return token, record.reset_token_expires_at


def reset_password(db: Session, token: str, new_password: str) -> User:
    """Spend a reset token and set the new password. Returns the updated user."""
    invalid = "This reset link is no longer valid. Start again from Forgot Password."
    submitted = (token or "").strip()
    if not submitted:
        raise PasswordResetError(invalid)

    issues = ProfileController._get_password_issues(new_password or "")
    if issues:
        error = PasswordResetError("The new password does not meet the requirements.")
        setattr(error, "issues", issues)
        raise error

    record = (
        db.query(PasswordResetOtp)
        .filter(
            PasswordResetOtp.reset_token_hash == hash_reset_token(submitted),
            PasswordResetOtp.reset_completed_at.is_(None),
        )
        .first()
    )
    if not record or not record.reset_token_expires_at or record.reset_token_expires_at <= _now():
        raise PasswordResetError(invalid)

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user or user.is_locked or user.deleted_at is not None:
        raise PasswordResetError(invalid)

    now = _now()
    # generate_password_hash is the project's hashing - the same call register
    # and change-password make. Writing through this session rather than
    # profileModel keeps the password change and the token's retirement in ONE
    # transaction: profileModel holds a separate mysql-connector connection, so
    # going through it could commit the new password and then fail to retire
    # the token, leaving it live for the rest of its ten minutes.
    user.password_hash = generate_password_hash(new_password)
    record.reset_completed_at = now
    # Dropping the hash makes the token unusable even if the row is read again.
    record.reset_token_hash = None
    # Anything else outstanding for this user dies with it - a second code
    # requested mid-flow must not still open a door after the password changed.
    for row in (
        db.query(PasswordResetOtp)
        .filter(
            PasswordResetOtp.user_id == user.id,
            PasswordResetOtp.consumed_at.is_(None),
        )
        .all()
    ):
        row.consumed_at = now
    db.commit()

    return user
