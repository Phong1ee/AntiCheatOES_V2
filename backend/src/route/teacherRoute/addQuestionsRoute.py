from fastapi import APIRouter, HTTPException, Depends
from src.models.teacher.requestModel.QuestionAddToExamRequest import QuestionAddToExamRequest
from src.models.teacher.requestModel.QuestionAddToDBRequest import QuestionAddToDBRequest
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest
from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
from src.controller.teacherController.examController import ExamController
from src.middleware.authMiddleware import verify_token, ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY
from sqlalchemy.orm import sessionmaker
from database import SessionLocal, engine
from src.a_db_config import Question, User, ExamQuestion, Option

router = APIRouter()

Session = sessionmaker(bind=engine)
session = Session()

@router.post("/add-question")
async def add_question_to_database(
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


@router.post("/{exam_id}/add-question")
async def add_question_to_exam(
    exam_id: str,
    request: QuestionAddToExamRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Add question to a specific exam."""
    question_add = ExamQuestion(
        exam_id=exam_id,
        question_id=request.question_id,
        question_point=request.question_point,
    )
    options = request.options
    for option in options:
        option_add = Option(
            question_id=request.question_id,
            options_text=option.options_text,
            is_correct=option.is_correct
        )
        session.add(option_add)
    session.add(question_add)
    session.commit()

@router.put("/{exam_id}/update-question/{question_id}")
async def update_question_in_exam(
    exam_id: str,
    question_id: str,
    request: QuestionUpdateRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Update question in a specific exam."""
    question_update = session.query(ExamQuestion).filter_by(exam_id=exam_id, question_id=question_id).first()
    if not question_update:
        raise HTTPException(status_code=404, detail="Question not found in the exam")
    options_update = session.query(Option).filter_by(question_id=question_id).all()
    if not options_update:
        raise HTTPException(status_code=404, detail="Options not found for the question")
    for option in request.options:
        option_update = next((opt for opt in options_update if opt.options_id == option.options_id), None)
        if option_update:
            option_update.options_text = option.options_text
            option_update.is_correct = option.is_correct
    question_update.question_point = request.question_point
    session.commit()
    
@router.delete("/{exam_id}/delete-question/{question_id}")
async def delete_question_from_exam(
    exam_id: str,
    question_id: str,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Delete question from a specific exam."""
    question_delete = session.query(ExamQuestion).filter_by(exam_id=exam_id, question_id=question_id).first()
    if not question_delete:
        raise HTTPException(status_code=404, detail="Question not found in the exam")
    options_delete = session.query(Option).filter_by(question_id=question_id).all()
    for option in options_delete:
        session.delete(option)
    session.delete(question_delete)
    session.commit()
    
@router.delete("/delete-question/{question_id}")
async def delete_question_from_database(
    question_id: str,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY)
):
    """Delete question from database."""
    question_delete = session.query(Question).filter_by(question_id=question_id).first()
    if not question_delete:
        raise HTTPException(status_code=404, detail="Question not found in the database")
    options_delete = session.query(Option).filter_by(question_id=question_id).all()
    for option in options_delete:
        session.delete(option)
    session.delete(question_delete)
    session.commit()