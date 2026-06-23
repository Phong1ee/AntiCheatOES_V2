from fastapi import APIRouter, HTTPException, Depends
from src.controller.examController import ExamController
from src.middleware.authMiddleware import verify_token
import sys

router = APIRouter()

@router.get("")
async def get_teacher_exams(current_user: dict = Depends(verify_token)):
    """Get all exams created by the current teacher."""
    try:
        # Get teacher ID from the token
        teacher_id = current_user.get('school_id')
        print(f"Current user: {current_user}", file=sys.stderr)
        print(f"Teacher ID from token: {teacher_id}", file=sys.stderr)
        
        if not teacher_id:
            raise HTTPException(status_code=403, detail="Teacher ID not found in token")
            
        result = ExamController.get_exams_by_teacher(teacher_id)
        print(f"Exams result: {result}", file=sys.stderr)
        return result
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        raise HTTPException(status_code=400, detail=str(e))
