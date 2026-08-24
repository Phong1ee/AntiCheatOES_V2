import os

from fastapi import APIRouter, HTTPException, Depends, Request
from mysql.connector import Error as MySQLError
from pydantic import BaseModel
from src.controller.authController import AuthController
from src.middleware.authMiddleware import verify_token
from src.service.rate_limit_service import RateLimitUnavailable, check as check_rate_limit

router = APIRouter()


def _limit(name: str, default: int) -> int:
    return max(1, int(os.getenv(name, str(default))))


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _enforce_auth_limit(scope: str, subject: str, limit: int, window: int) -> None:
    try:
        allowed = check_rate_limit(scope, subject, limit, window)
    except RateLimitUnavailable as exc:
        # Authentication is intentionally fail-closed. This cannot affect the
        # exam-critical routes because they never call this limiter.
        raise HTTPException(status_code=503, detail="Authentication temporarily unavailable") from exc
    if not allowed:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    fullname: str
    email: str
    password: str
    role: str


@router.post("/login")
def login(request: LoginRequest, http_request: Request):
    """Endpoint for user login."""
    email = request.email.strip().lower()
    _enforce_auth_limit("login:ip", _client_ip(http_request), _limit("AUTH_LOGIN_IP_LIMIT", 60), _limit("AUTH_LOGIN_IP_WINDOW", 900))
    _enforce_auth_limit("login:email", email or "empty", _limit("AUTH_LOGIN_EMAIL_LIMIT", 10), _limit("AUTH_LOGIN_EMAIL_WINDOW", 900))
    try:
        result = AuthController.login(email, request.password)
        return result
    except MySQLError as exc:
        # A saturated or unavailable credential store is not a bad password.
        # Reporting it as 503 prevents clients and load tooling from treating a
        # capacity fault as an authentication failure.
        raise HTTPException(status_code=503, detail="Authentication temporarily unavailable") from exc
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid email or password")


@router.post("/register")
def register(request: RegisterRequest):
    """Endpoint for user registration."""
    try:
        result = AuthController.register(
            fullname=request.fullname,
            email=request.email,
            password=request.password,
            role=request.role
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/logout")
async def logout():
    """Endpoint for user logout."""
    return {"success": True, "message": "Logged out successfully"}


@router.get("/me")
def get_me(current_user: dict = Depends(verify_token)):
    """Get current authenticated user profile."""
    try:
        return AuthController.get_me(current_user["school_id"])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
