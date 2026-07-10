from fastapi import APIRouter, HTTPException, Depends
from src.middleware.authMiddleware import verify_token, ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY
from sqlalchemy.orm import sessionmaker
from database import SessionLocal, engine
from src.a_db_config import Exam, User, ExamQuestion, Question, Option

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