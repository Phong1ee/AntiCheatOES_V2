from fastapi import APIRouter, Depends
from src.models.requestModel.addQuestionModel import QuestionAddToExamRequest
from src.controller.examController import ExamController
from src.middleware.authMiddleware import TEACHER_ONLY

router = APIRouter()

@router.post("/{exam_id}/add-questions")
async def add_questions_to_exam(
    exam_id: int,
    request: QuestionAddToExamRequest,
    current_user: dict = Depends(TEACHER_ONLY),
):
    """Add questions to an exam."""
    result = ExamController.addQuestionsToExam(
        exam_id,
        [question.model_dump(exclude_none=True) for question in request.questions],
        current_user["school_id"],
        current_user["role"]
    )
    return result
