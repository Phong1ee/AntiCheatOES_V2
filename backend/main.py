from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from src.route import router as default_router
from src.route.teacherRoute import router as teacher_router

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
app.include_router(default_router, prefix="/api", tags=["default"])
app.include_router(teacher_router, prefix="/api/teacher", tags=["teacher-exams"])

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
