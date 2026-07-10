from fastapi import APIRouter
from .addQuestionsRoute import router as add_questions_router
from .getExamsRoute import router as get_exams_router
from .addExamRoute import router as add_exam_router

router = APIRouter()
router.include_router(add_questions_router)
router.include_router(get_exams_router)
router.include_router(add_exam_router)
