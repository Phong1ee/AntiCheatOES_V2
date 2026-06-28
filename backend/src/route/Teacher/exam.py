from fastapi import APIRouter, HTTPException, Depends
from typing import List
from src.controller.teacherController.examController import ExamController
from src.middleware.authMiddleware import verify_token, TEACHER_ONLY
from src.route.Teacher.teacher_class import *

router = APIRouter()

@router.get("/", response_model=List[TeacherExam])
async def get_exams(current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY)):
    """Endpoint for getting exams created by a teacher."""
    try:
        result = ExamController.get_exams_by_teacher(current_user["school_id"])
        return result["exams"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


