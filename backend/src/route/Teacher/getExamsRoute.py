from fastapi import APIRouter, HTTPException, Depends
# from src.models.requestModel.TeacherExamRequest import TeacherExamRequest
from src.controller.examController import ExamController
from src.middleware.authMiddleware import verify_token, ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY
from sqlalchemy.orm import sessionmaker
from database import SessionLocal, engine
from src.a_db_config import Exam, User

router = APIRouter()

Session = sessionmaker(bind=engine)
session = Session()

@router.get("/get_exams")
async def get_exams(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Get teacher's exams."""
    managed = session.query(User).filter_by(school_id=current_user["school_id"]).first()
    exam_list = session.query(Exam).filter_by(manage_by=managed.id).all()
    return exam_list

