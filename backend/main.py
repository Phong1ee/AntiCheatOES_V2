from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from src.route.authRoute import router as auth_router
from src.route.examRoute import router as exam_router
from src.route.profileRoute import router as profile_router
from src.route.resultsRoute import router as results_router
from src.route.Teacher import router as teacher_router
from sqlalchemy.orm import Session
from database import Base, engine, SessionLocal
import src.a_db_config  

# Initialize FastAPI app
app = FastAPI(title="Online Examination System API", version="0.1.0")

# Configure CORS to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

src.a_db_config.Base.metadata.create_all(bind=engine)  # Create tables if they don't exist

# Health check endpoint
@app.get("/")
def read_root():
    """Health check endpoint"""
    return {"status": "Backend is running"}

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(teacher_router, prefix="/api/teacher", tags=["teacher"])
app.include_router(teacher_router, prefix="/api/exams", tags=["teacher"])
app.include_router(exam_router, prefix="/api/exams", tags=["exams"])
app.include_router(profile_router, prefix="/api/profile", tags=["profile"])
app.include_router(results_router, prefix="/api/results", tags=["results"])

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
