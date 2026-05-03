from fastapi import APIRouter, HTTPException, Depends
from src.controller.examController import ExamController
from src.middleware.authMiddleware import verify_token

router = APIRouter()

@router.get("")
async def get_student_exams_root(current_user: dict = Depends(verify_token)):
    """Get all exams assigned to the current student."""
    try:
        result = ExamController.getStudentExams(current_user['school_id'])
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/student")
async def get_student_exams(current_user: dict = Depends(verify_token)):
    """Get all exams assigned to the current student."""
    try:
        result = ExamController.getStudentExams(current_user['school_id'])
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{exam_id}")
async def get_exam(exam_id: int, current_user: dict = Depends(verify_token)):
    """Get exam details with all questions and options."""
    try:
        result = ExamController.getExamWithQuestions(exam_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))