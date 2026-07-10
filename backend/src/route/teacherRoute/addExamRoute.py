from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from src.models.teacher.requestModel.TeacherExamRequest import TeacherExamRequest
from src.middleware.authMiddleware import verify_token, ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY
from sqlalchemy.orm import sessionmaker
from database import SessionLocal, engine
from src.a_db_config import Exam, User

router = APIRouter()

Session = sessionmaker(bind=engine)
session = Session()

@router.post("/add_exam")
async def add_exam_to_database(
    request: TeacherExamRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Add question to database."""
    creator = session.query(User).filter_by(school_id=current_user["school_id"]).first()
    exam_add = Exam(
        title=request.title,
        examcode=request.examcode,
        duration_minutes=request.duration_minutes,
        manage_by=creator.school_id,
        max_attempt=request.max_attemmpt,
        description=request.description,
        start_time=datetime.now(),
        end_time=datetime.now()+ timedelta(minutes=request.duration_minutes),
        result_visibility=request.result_visibility,
        subject_id=request.subject_id,
    )
    session.add(exam_add)
    session.commit()
