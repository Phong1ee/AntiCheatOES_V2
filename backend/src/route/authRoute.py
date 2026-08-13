from fastapi import APIRouter, HTTPException, Depends
from mysql.connector import Error as MySQLError
from pydantic import BaseModel
from src.controller.authController import AuthController
from src.middleware.authMiddleware import verify_token

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    fullname: str
    email: str
    password: str
    role: str


@router.post("/login")
def login(request: LoginRequest):
    """Endpoint for user login."""
    try:
        result = AuthController.login(request.email, request.password)
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
