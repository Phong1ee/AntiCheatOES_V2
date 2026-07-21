from fastapi import APIRouter
from .questionBankRoute import router as question_bank_router
from .addQuestionsRoute import router as add_questions_router
from .getExamsRoute import router as get_exams_router
from .addExamRoute import router as add_exam_router
from .examSettingsRoute import router as exam_settings_router

router = APIRouter()
router.include_router(question_bank_router)
router.include_router(add_questions_router)
router.include_router(get_exams_router)
router.include_router(add_exam_router)
router.include_router(exam_settings_router)
