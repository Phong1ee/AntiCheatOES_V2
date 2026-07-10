from fastapi import APIRouter, HTTPException, Depends
from src.models.requestModel.QuestionAddToDBRequest import QuestionAddToDBRequest
from src.controller.teacherController.examController import ExamController
from src.middleware.authMiddleware import verify_token, ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY
from sqlalchemy.orm import sessionmaker
from database import SessionLocal, engine
from src.a_db_config import Question, User

router = APIRouter()

Session = sessionmaker(bind=engine)
session = Session()

@router.post("/{exam_id}/add-question")
async def add_question_to_database(
    exam_id: str,
    request: QuestionAddToDBRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Add question to database."""
    creator = session.query(User).filter_by(school_id=current_user["school_id"]).first()
    question_add = Question(
        question_id=request.question_id,
        question_text=request.question_text,
        question_difficulties=request.question_difficulties,
        question_type=request.question_type,
        chapter_id=request.chapter_id,
        created_by=creator.id,
        question_status=request.question_status
    )
    session.add(question_add)
    session.commit()
