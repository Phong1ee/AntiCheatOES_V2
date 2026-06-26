from fastapi import APIRouter, HTTPException, Depends
from src.models.requestModel.addQuestionModel import QuestionAddToExamRequest
from src.controller.examController import ExamController
#from src.controller.authController import ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY
from src.middleware.authMiddleware import verify_token, ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY

router = APIRouter()

@router.post("/{exam_id}/add-questions")
async def add_questions_to_exam(
    exam_id: int,
    request: QuestionAddToExamRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Add questions to an exam."""
    result = ExamController.addQuestionsToExam(
        exam_id,
        request.questions,
        current_user["school_id"],
        current_user["role"]
    )
    return result
