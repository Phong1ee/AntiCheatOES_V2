from fastapi import APIRouter

from src.route.Teacher import router as teacher_router
from src.route.authRoute import router as auth_router
from src.route.examRoute import router as exam_router
from src.route.profileRoute import router as profile_router
from src.route.resultsRoute import router as results_router

router = APIRouter()

router.include_router(auth_router, prefix="/api/auth", tags=["auth"])
router.include_router(exam_router, prefix="/api/exams", tags=["exams"])
router.include_router(profile_router, prefix="/api/profile", tags=["profile"])
router.include_router(results_router, prefix="/api/results", tags=["results"])
router.include_router(teacher_router, prefix="/api/exams", tags=["teacher"])
