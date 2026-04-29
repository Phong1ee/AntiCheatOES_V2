from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.controller.authController import AuthController

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
async def login(request: LoginRequest):
    """Endpoint for user login."""
    try:
        result = AuthController.login(request.email, request.password)
        return result
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password") 

@router.post("/register")
async def register(request: RegisterRequest):
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
        raise HTTPException(status_code=400, detail="Registration failed")

@router.post("/logout")
async def logout():
    """Endpoint for user logout."""
    return {"success": True, "message": "Logged out successfully"}

@router.get("/")