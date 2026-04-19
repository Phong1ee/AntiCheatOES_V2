from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

# Initialize FastAPI app
app = FastAPI(title="Online Examination System API", version="0.1.0")

# Configure CORS to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite default port and common dev ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "student"

class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[dict] = None
    token: Optional[str] = None

# Routes
@app.get("/")
def read_root():
    """Health check endpoint"""
    return {"status": "Backend is running"}

@app.post("/api/auth/login", response_model=AuthResponse)
def login(request: LoginRequest):
    """User login endpoint"""
    # TODO: Implement actual authentication with database
    if not request.username or not request.password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    # Mock response
    return AuthResponse(
        success=True,
        message="Login successful",
        user={
            "id": "1",
            "username": request.username,
            "role": "student"
        },
        token="mock_token_123"
    )

@app.post("/api/auth/register", response_model=AuthResponse)
def register(request: RegisterRequest):
    """User registration endpoint"""
    # TODO: Implement actual user registration with database
    if not request.username or not request.email or not request.password:
        raise HTTPException(status_code=400, detail="All fields required")
    
    return AuthResponse(
        success=True,
        message="Registration successful",
        user={
            "id": "1",
            "username": request.username,
            "email": request.email,
            "role": request.role or "student"
        }
    )

@app.post("/api/auth/logout")
def logout():
    """User logout endpoint"""
    return {"success": True, "message": "Logged out successfully"}

@app.get("/api/auth/me")
def get_current_user():
    """Get current authenticated user"""
    # TODO: Implement actual user verification with JWT
    return {
        "id": "1",
        "username": "student",
        "role": "student"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
