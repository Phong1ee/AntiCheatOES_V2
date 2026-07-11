from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from src.middleware.authMiddleware import verify_token, ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY
from sqlalchemy.orm import sessionmaker
from database import SessionLocal, engine
from src.a_db_config import Exam, User, ExamQuestion, Question, Option

router = APIRouter()

Session = sessionmaker(bind=engine)
session = Session()


def get_exam_status(exam, now_time: datetime | None = None) -> str:
    """Compute a frontend-friendly exam status."""
    current_time = now_time or datetime.now()

    if exam.start_time and current_time < exam.start_time:
        return "upcoming"
    if exam.start_time and exam.end_time and exam.start_time <= current_time <= exam.end_time:
        return "ongoing"
    if exam.end_time and current_time > exam.end_time:
        return "completed"
    return "ongoing"


@router.get("/exams")
async def get_teacher_exams(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Get teacher's exams."""
    managed = session.query(User).filter_by(school_id=current_user["school_id"]).first()
    if not managed:
        raise HTTPException(status_code=404, detail="Teacher not found")

    exam_list = session.query(Exam).filter_by(manage_by=managed.school_id).all()
    now_time = datetime.now()

    result = []
    for exam in exam_list:
        exam_data = {
            "exam_id": exam.exam_id,
            "title": exam.title,
            "examcode": exam.examcode,
            "description": exam.description,
            "max_attempt": exam.max_attempt,
            "duration_minutes": exam.duration_minutes,
            "start_time": exam.start_time.isoformat() if exam.start_time else None,
            "end_time": exam.end_time.isoformat() if exam.end_time else None,
            "totalStudents": 0,
            "manage_by": exam.manage_by,
            "status": get_exam_status(exam, now_time),
            "subject": exam.subject.subject_name if exam.subject else None,
        }
        result.append(exam_data)

    return result

@router.get("/get_exams")
async def get_exams(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Backwards-compatible alias for teacher exams."""
    return await get_teacher_exams(current_user=current_user, role_check=role_check)

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

@router.get("/get_exam_questions/{exam_id}")
async def get_exam_questions(
    exam_id: str,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Get questions for a specific exam by ID."""
    managed = session.query(User).filter_by(school_id=current_user["school_id"]).first()
    exam = session.query(Exam).filter_by(exam_id=exam_id, manage_by=managed.school_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    questions = session.query(ExamQuestion).filter_by(exam_id=exam.exam_id).all()
    return questions

@router.get("/get_exam_question/{exam_id}/{question_id}")
async def get_exam_question(
    exam_id: str,
    question_id: str,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Get a specific question for a specific exam by IDs."""
    managed = session.query(User).filter_by(school_id=current_user["school_id"]).first()
    exam = session.query(Exam).filter_by(exam_id=exam_id, manage_by=managed.school_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    question_id = session.query(ExamQuestion).filter_by(exam_id=exam.exam_id, question_id=question_id).first()
    if not question_id:
        raise HTTPException(status_code=404, detail="Question not found in this exam")
    
    query = session.query(Question).filter_by(question_id=question_id.question_id).first()
    options = session.query(Option).filter_by(question_id=query.question_id).all()
    question_data = {
        "question_id": query.question_id,
        "question_text": query.question_text,
        "question_difficulties": query.question_difficulties,
        "question_type": query.question_type,
        "chapter_id": query.chapter_id,
        "created_by": query.created_by,
        "question_status": query.question_status,
        "options": [{"options_id": option.options_id, "options_text": option.options_text, "is_correct": option.is_correct} for option in options]
    }
    return question_data