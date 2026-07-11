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

@router.put("/update_exam/{exam_id}")
async def update_exam_in_database(
    exam_id: str,
    request: TeacherExamRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Update question in database."""
    exam = session.query(Exam).filter_by(exam_id=exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Update the exam fields with the new values from the request
    exam.title = request.title
    exam.examcode = request.examcode
    exam.duration_minutes = request.duration_minutes
    exam.max_attempt = request.max_attemmpt
    exam.description = request.description
    exam.result_visibility = request.result_visibility
    exam.subject_id = request.subject_id

    session.commit()

@router.delete("/delete_exam/{exam_id}")
async def delete_exam_from_database(
    exam_id: str,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Delete question from database."""
    exam = session.query(Exam).filter_by(exam_id=exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    session.delete(exam)
    session.commit()