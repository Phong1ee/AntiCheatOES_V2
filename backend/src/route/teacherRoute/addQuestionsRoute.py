from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from src.a_db_config import (
    Chapter,
    ChapterLO,
    ChapterQuestion,
    Exam,
    ExamQuestion,
    LO,
    LOQuestion,
    Option,
    Question,
    Subject,
    User,
)
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token
from src.models.teacher.requestModel.QuestionAddToDBRequest import QuestionAddToDBRequest
from src.models.teacher.requestModel.QuestionAddToExamRequest import QuestionAddToExamRequest
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest
from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest

router = APIRouter()


def _teacher(db: Session, school_id: str) -> User:
    teacher = db.query(User).filter(User.school_id == school_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return teacher


def _owned_exam(db: Session, exam_id: int, school_id: str) -> Exam:
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.manage_by != school_id:
        raise HTTPException(status_code=403, detail="You do not manage this exam")
    return exam


def _validate_options(question_type: str, options: list[QuestionOptionsRequest]) -> None:
    non_empty = [option for option in options if option.options_text.strip()]
    if len(non_empty) != len(options):
        raise HTTPException(status_code=400, detail="Option text cannot be empty")
    correct_count = sum(option.is_correct for option in options)
    if question_type == "MCQ":
        if len(options) < 2:
            raise HTTPException(status_code=400, detail="MCQ questions require at least two options")
        if correct_count < 1:
            raise HTTPException(status_code=400, detail="MCQ questions require at least one correct option")
    elif question_type == "true-false":
        normalized = {option.options_text.strip().lower() for option in options}
        if len(options) != 2 or normalized != {"true", "false"}:
            raise HTTPException(status_code=400, detail="True/false questions require exactly True and False options")
        if correct_count != 1:
            raise HTTPException(status_code=400, detail="True/false questions require exactly one correct option")
    elif options:
        raise HTTPException(status_code=400, detail="Essay questions do not accept options")


def _validate_taxonomy(
    db: Session, subject_id: str, chapter_ids: list[int], lo_ids: list[int]
) -> tuple[list[Chapter], list[LO]]:
    if not db.query(Subject).filter(Subject.subject_id == subject_id).first():
        raise HTTPException(status_code=404, detail="Subject not found")

    unique_chapters = list(dict.fromkeys(chapter_ids))
    chapters = db.query(Chapter).filter(Chapter.chapter_id.in_(unique_chapters)).all() if unique_chapters else []
    if len(chapters) != len(unique_chapters):
        raise HTTPException(status_code=404, detail="One or more chapters were not found")
    if any(chapter.subject_id != subject_id for chapter in chapters):
        raise HTTPException(status_code=400, detail="Every selected chapter must belong to the question subject")

    unique_los = list(dict.fromkeys(lo_ids))
    los = db.query(LO).filter(LO.lo_id.in_(unique_los)).all() if unique_los else []
    if len(los) != len(unique_los):
        raise HTTPException(status_code=404, detail="One or more learning outcomes were not found")
    if unique_los:
        lo_query = (
            db.query(ChapterLO.lo_id)
            .join(Chapter, Chapter.chapter_id == ChapterLO.chapter_id)
            .filter(Chapter.subject_id == subject_id, ChapterLO.lo_id.in_(unique_los))
        )
        if unique_chapters:
            lo_query = lo_query.filter(ChapterLO.chapter_id.in_(unique_chapters))
        valid_lo_ids = {
            row[0]
            for row in lo_query.all()
        }
        if valid_lo_ids != set(unique_los):
            raise HTTPException(status_code=400, detail="Every selected learning outcome must belong to the question subject")
    return chapters, los


def _replace_options(db: Session, question: Question, requested: list[QuestionOptionsRequest]) -> None:
    question_type = question.question_type.value if hasattr(question.question_type, "value") else question.question_type
    _validate_options(question_type, requested)
    existing = {option.options_id: option for option in question.options}
    requested_existing_ids = {option.options_id for option in requested if option.options_id is not None}
    unknown_ids = requested_existing_ids - set(existing)
    if unknown_ids:
        raise HTTPException(status_code=400, detail="An option ID does not belong to this question")

    for option_id, option in existing.items():
        if option_id not in requested_existing_ids:
            db.delete(option)
    for item in requested:
        if item.options_id is None:
            db.add(Option(question_id=question.question_id, options_text=item.options_text.strip(), is_correct=item.is_correct))
        else:
            existing[item.options_id].options_text = item.options_text.strip()
            existing[item.options_id].is_correct = item.is_correct


@router.post("/add-question", status_code=status.HTTP_201_CREATED)
def add_question_to_database(
    request: QuestionAddToDBRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    """Create a reusable question and optionally attach it to an owned exam atomically."""
    del role_check
    try:
        creator = _teacher(db, current_user["school_id"])
        chapters, los = _validate_taxonomy(db, request.subject_id, request.chapter_ids, request.lo_ids)
        _validate_options(request.question_type, request.options)
        if request.exam_id is not None:
            exam = _owned_exam(db, request.exam_id, creator.school_id)
            if exam.subject_id != request.subject_id:
                raise HTTPException(status_code=400, detail="Question subject must match the exam subject")

        question = Question(
            question_text=request.question_text.strip(),
            question_difficulties=request.question_difficulties,
            question_type=request.question_type,
            subject_id=request.subject_id,
            created_by=creator.id,
            question_status="draft",
        )
        db.add(question)
        db.flush()
        db.add_all(ChapterQuestion(chapter_id=chapter.chapter_id, question_id=question.question_id) for chapter in chapters)
        db.add_all(LOQuestion(lo_id=lo.lo_id, question_id=question.question_id) for lo in los)
        db.add_all(
            Option(question_id=question.question_id, options_text=item.options_text.strip(), is_correct=item.is_correct)
            for item in request.options
        )
        if request.exam_id is not None:
            db.add(ExamQuestion(exam_id=request.exam_id, question_id=question.question_id, question_point=request.question_point))
        db.commit()
        db.refresh(question)
        return {"success": True, "question_id": question.question_id}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question could not be created because related data changed") from exc
    except Exception:
        db.rollback()
        raise


@router.post("/{exam_id}/add-question", status_code=status.HTTP_201_CREATED)
def add_question_to_exam(
    exam_id: int,
    request: QuestionAddToExamRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    """Attach an existing reusable question to an owned exam."""
    del role_check
    try:
        exam = _owned_exam(db, exam_id, current_user["school_id"])
        question = db.query(Question).filter(Question.question_id == request.question_id).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        if question.subject_id != exam.subject_id:
            raise HTTPException(status_code=400, detail="Question subject must match the exam subject")
        if db.query(ExamQuestion).filter_by(exam_id=exam_id, question_id=request.question_id).first():
            raise HTTPException(status_code=409, detail="Question is already in this exam")
        if request.options:
            if question.options:
                raise HTTPException(status_code=409, detail="Question already has options")
            _validate_options(question.question_type.value, request.options)
            db.add_all(Option(question_id=question.question_id, options_text=o.options_text.strip(), is_correct=o.is_correct) for o in request.options)
        elif question.question_type.value != "essay":
            _validate_options(question.question_type.value, list(question.options))
        link = ExamQuestion(exam_id=exam_id, question_id=question.question_id, question_point=request.question_point)
        db.add(link)
        db.commit()
        return {"success": True, "question_id": question.question_id}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question could not be added to the exam") from exc


@router.put("/{exam_id}/update-question/{question_id}")
def update_question_in_exam(
    exam_id: int,
    question_id: int,
    request: QuestionUpdateRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    """Update an exam question and its reusable question-bank data atomically."""
    del role_check
    try:
        _owned_exam(db, exam_id, current_user["school_id"])
        link = db.query(ExamQuestion).filter_by(exam_id=exam_id, question_id=question_id).first()
        if not link:
            raise HTTPException(status_code=404, detail="Question not found in the exam")
        question = db.query(Question).filter(Question.question_id == question_id).first()
        target_subject = request.subject_id or question.subject_id
        chapter_ids = request.chapter_ids if request.chapter_ids is not None else [item.chapter_id for item in question.chapter_questions]
        lo_ids = request.lo_ids if request.lo_ids is not None else [item.lo_id for item in question.lo_questions]
        chapters, los = _validate_taxonomy(db, target_subject, chapter_ids, lo_ids)

        if request.question_text is not None:
            question.question_text = request.question_text.strip()
        if request.question_difficulties is not None:
            question.question_difficulties = request.question_difficulties
        if request.question_type is not None:
            question.question_type = request.question_type
        question.subject_id = target_subject
        # Status is server-controlled for reusable questions. Teacher exam edits
        # may change content/points, but cannot directly approve a question.
        link.question_point = request.question_point

        if request.chapter_ids is not None:
            question.chapter_questions.clear()
            question.chapter_questions.extend(ChapterQuestion(chapter_id=chapter.chapter_id) for chapter in chapters)
        if request.lo_ids is not None:
            question.lo_questions.clear()
            question.lo_questions.extend(LOQuestion(lo_id=lo.lo_id) for lo in los)
        _replace_options(db, question, request.options)
        db.commit()
        return {"success": True, "message": "Question updated successfully"}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question options are referenced by submitted answers") from exc
    except Exception:
        db.rollback()
        raise


@router.delete("/{exam_id}/delete-question/{question_id}")
def delete_question_from_exam(
    exam_id: int,
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    """Remove only the exam_question association; keep reusable question data."""
    del role_check
    try:
        _owned_exam(db, exam_id, current_user["school_id"])
        link = db.query(ExamQuestion).filter_by(exam_id=exam_id, question_id=question_id).first()
        if not link:
            raise HTTPException(status_code=404, detail="Question not found in the exam")
        db.delete(link)
        db.commit()
        return {"success": True, "message": "Question removed from exam"}
    except HTTPException:
        db.rollback()
        raise


@router.delete("/delete-question/{question_id}")
def delete_question_from_database(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    """Permanently delete a question created by the authenticated teacher."""
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        question = db.query(Question).filter(Question.question_id == question_id).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found in the database")
        if question.created_by != teacher.id:
            raise HTTPException(status_code=403, detail="You do not own this question")
        db.delete(question)
        db.commit()
        return {"success": True, "message": "Question permanently deleted"}
    except HTTPException:
        db.rollback()
        raise
