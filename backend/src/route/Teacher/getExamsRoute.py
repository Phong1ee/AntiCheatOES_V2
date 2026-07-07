from fastapi import APIRouter, HTTPException, Depends
# from src.models.requestModel.TeacherExamRequest import TeacherExamRequest
from src.controller.examController import ExamController
from src.models.requestModel.TeacherExamRequest import TeacherExamRequest
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
    exam_list = session.query(Exam).filter_by(manage_by=managed.school_id).all()
    print(exam_list)
    return exam_list

@router.get("/get_exam/{exam_id}")
async def get_exam(
    exam_id: str,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Get a specific exam by ID."""
    managed = session.query(User).filter_by(school_id=current_user["school_id"]).first()
    exam = session.query(Exam).filter_by(exam_id=exam_id, manage_by=managed.school_id).first()
    return exam