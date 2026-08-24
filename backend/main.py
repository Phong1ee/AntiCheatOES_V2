import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from src.route.authRoute import router as auth_router
# from backend.src.route.teacherRoute.examRoute import router as exam_router
from src.route.profileRoute import router as profile_router
from src.route.avatarRoute import router as avatar_router
from src.route.passwordResetRoute import router as password_reset_router
from src.route.studentRoute.examRoute import router as exam_router
from src.route.teacherRoute.questionImageRoute import student_router as student_question_image_router
from src.route.resultsRoute import router as results_router
from src.route.teacherRoute import router as teacher_router
from src.route.adminRoute import router as admin_router
from sqlalchemy.orm import Session
import src.a_db_config  
from src.service.cache_service import close_cache_client
from src.middleware.observabilityMiddleware import ObservabilityMiddleware
from src.service.health_service import readiness

UVICORN_ACCESS_LOG = os.getenv("UVICORN_ACCESS_LOG", "true").strip().lower() in {"1", "true", "yes", "on"}
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
_LOCAL_DEVELOPMENT_ORIGINS = [
    "http://localhost:5173", "http://localhost:5174", "http://localhost:5175",
    "http://localhost:3000", "http://localhost:5000", "http://127.0.0.1:5173",
    "http://127.0.0.1:5174", "http://127.0.0.1:5175", "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
]


def _configured_cors_origins() -> list[str]:
    """Return explicit CORS origins and refuse an unsafe production default."""
    if APP_ENV not in {"development", "staging", "production"}:
        raise RuntimeError("APP_ENV must be development, staging, or production.")

    configured = os.getenv("CORS_ALLOWED_ORIGINS") or os.getenv("FRONTEND_ORIGIN", "")
    origins = [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    if APP_ENV in {"staging", "production"} and not origins:
        raise RuntimeError(f"{APP_ENV} requires FRONTEND_ORIGIN or CORS_ALLOWED_ORIGINS.")
    return [*_LOCAL_DEVELOPMENT_ORIGINS, *origins] if APP_ENV == "development" else origins

@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    yield
    close_cache_client()


# Initialize FastAPI app
app = FastAPI(title="Online Examination System API", version="0.1.0", lifespan=app_lifespan)
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper(), format="%(message)s")
app.add_middleware(ObservabilityMiddleware)

# Configure CORS to allow only configured browser origins with credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/")
def read_root():
    """Health check endpoint"""
    return {"status": "Backend is running"}


@app.get("/health/live")
def health_live():
    """Liveness intentionally checks only that this API process can respond."""
    return {"status": "live"}


@app.get("/health/ready")
def health_ready(response: Response):
    """MySQL is critical; Redis and RabbitMQ are reported as optional degradation."""
    payload = readiness()
    if payload["status"] != "ready":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return payload

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(password_reset_router, prefix="/api/auth", tags=["auth"])
app.include_router(teacher_router, prefix="/api/teacher", tags=["teacher"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
# app.include_router(teacher_router, prefix="/api/exams", tags=["teacher"])
app.include_router(exam_router, prefix="/api/exams", tags=["exams"])
app.include_router(student_question_image_router, prefix="/api/exams", tags=["exams"])
app.include_router(profile_router, prefix="/api/profile", tags=["profile"])
app.include_router(avatar_router, prefix="/api/profile", tags=["profile"])
app.include_router(results_router, prefix="/api/results", tags=["results"])

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, access_log=UVICORN_ACCESS_LOG)
