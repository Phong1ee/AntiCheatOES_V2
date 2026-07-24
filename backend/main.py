import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from src.route.authRoute import router as auth_router
# from backend.src.route.teacherRoute.examRoute import router as exam_router
from src.route.profileRoute import router as profile_router
from src.route.studentRoute.examRoute import router as exam_router
from src.route.resultsRoute import router as results_router
from src.route.teacherRoute import router as teacher_router
from src.route.adminRoute import router as admin_router
from sqlalchemy.orm import Session
import src.a_db_config  

UVICORN_ACCESS_LOG = os.getenv("UVICORN_ACCESS_LOG", "true").strip().lower() in {"1", "true", "yes", "on"}

# Initialize FastAPI app
app = FastAPI(title="Online Examination System API", version="0.1.0")

# Configure CORS to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/")
def read_root():
    """Health check endpoint"""
    return {"status": "Backend is running"}

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(teacher_router, prefix="/api/teacher", tags=["teacher"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
# app.include_router(teacher_router, prefix="/api/exams", tags=["teacher"])
app.include_router(exam_router, prefix="/api/exams", tags=["exams"])
app.include_router(profile_router, prefix="/api/profile", tags=["profile"])
app.include_router(results_router, prefix="/api/results", tags=["results"])

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, access_log=UVICORN_ACCESS_LOG)
