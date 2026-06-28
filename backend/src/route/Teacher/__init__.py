from fastapi import APIRouter
from .addQuestionsRoute import router as add_questions_router

router = APIRouter()
router.include_router(add_questions_router)