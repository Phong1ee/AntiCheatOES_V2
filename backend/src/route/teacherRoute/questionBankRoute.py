from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from database import get_db
from src.a_db_config import (
    Chapter,
    ChapterLO,
    ChapterQuestion,
    ExamQuestion,
    LO,
    LOQuestion,
    Option,
    Question,
    QuestionRevision,
    QuestionStatus,
    Subject,
    User,
)
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token

router = APIRouter(prefix="/question-bank")

QuestionTypeLiteral = Literal["MCQ", "essay", "true-false"]
QuestionDifficultyLiteral = Literal["easy", "medium", "hard"]
QuestionStatusLiteral = Literal["draft", "pending", "approved", "rejected"]


class QuestionOptionPayload(BaseModel):
    options_id: int | None = None
    options_text: str = ""
    is_correct: bool = False


class QuestionBankPayload(BaseModel):
    question_text: str = Field(min_length=1, max_length=255)
    question_type: QuestionTypeLiteral
    question_difficulties: QuestionDifficultyLiteral | None = None
    subject_id: str | None = Field(default=None, max_length=20)
    chapter_ids: list[int] = Field(default_factory=list)
    lo_ids: list[int] = Field(default_factory=list)
    options: list[QuestionOptionPayload] = Field(default_factory=list)


def _value(item):
    return item.value if hasattr(item, "value") else item


def _teacher(db: Session, school_id: str) -> User:
    teacher = db.query(User).filter(User.school_id == school_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return teacher


def _status(question: Question) -> str | None:
    return _value(question.question_status) if question.question_status else None


def _subject_summary(subject: Subject | None) -> dict | None:
    if not subject:
        return None
    return {"subject_id": subject.subject_id, "subject_name": subject.subject_name}


def _chapter_summary(link: ChapterQuestion) -> dict:
    chapter = link.chapter
    return {"chapter_id": chapter.chapter_id, "chapter_name": chapter.chapter_name}


def _lo_summary(link: LOQuestion) -> dict:
    lo = link.lo
    return {"lo_id": lo.lo_id, "lo_name": lo.lo_name}


def _permission_flags(question: Question, teacher: User, bank: bool) -> dict:
    owner = question.created_by == teacher.id
    question_status = _status(question)
    return {
        "can_view": question_status == "approved" or owner,
        "can_edit": (not bank) and owner and question_status in {"draft", "approved", "rejected"},
        "can_delete": (not bank) and owner and question_status in {"draft", "rejected"},
        "can_submit": (not bank) and owner and question_status == "draft",
        "can_resubmit": (not bank) and owner and question_status == "rejected",
    }


def _serialize_item(question: Question, teacher: User, bank: bool) -> dict:
    option_count = len([option for option in question.options if option.options_text.strip()])
    return {
        "question_id": question.question_id,
        "question_text": question.question_text,
        "question_type": _value(question.question_type),
        "question_difficulties": _value(question.question_difficulties) if question.question_difficulties else None,
        "question_status": _status(question),
        "subject": _subject_summary(question.subject),
        "chapters": [_chapter_summary(link) for link in question.chapter_questions],
        "learning_objectives": [_lo_summary(link) for link in question.lo_questions],
        "option_count": option_count,
        "created_at": None,
        "updated_at": None,
        "usage_count": len(question.exam_questions),
        "permissions": _permission_flags(question, teacher, bank),
    }


def _serialize_detail(question: Question, teacher: User) -> dict:
    data = _serialize_item(question, teacher, bank=False)
    data.update(
        {
            "created_by": question.created_by,
            "creator": (
                {
                    "id": question.creator.id,
                    "school_id": question.creator.school_id,
                    "full_name": question.creator.full_name,
                }
                if question.creator
                else None
            ),
            "options": [
                {
                    "options_id": option.options_id,
                    "options_text": option.options_text,
                    "is_correct": option.is_correct,
                }
                for option in sorted(question.options, key=lambda item: item.options_id)
            ],
            "rejected_feedback": None,
        }
    )
    return data


def _base_question_query(db: Session):
    return db.query(Question).options(
        selectinload(Question.subject),
        selectinload(Question.creator),
        selectinload(Question.options),
        selectinload(Question.exam_questions),
        selectinload(Question.chapter_questions).selectinload(ChapterQuestion.chapter),
        selectinload(Question.lo_questions).selectinload(LOQuestion.lo),
    )


def _apply_filters(
    query,
    subject_id: str | None,
    chapter_id: int | None,
    lo_id: int | None,
    search: str | None,
    question_type: QuestionTypeLiteral | None,
    difficulty: QuestionDifficultyLiteral | None,
):
    query = query.outerjoin(Subject, Question.subject_id == Subject.subject_id)
    if subject_id == "__none__":
        query = query.filter(Question.subject_id.is_(None))
    elif subject_id:
        query = query.filter(Question.subject_id == subject_id)
    if chapter_id is not None:
        query = query.join(ChapterQuestion, Question.question_id == ChapterQuestion.question_id).filter(
            ChapterQuestion.chapter_id == chapter_id
        )
    if lo_id is not None:
        query = query.join(LOQuestion, Question.question_id == LOQuestion.question_id).filter(LOQuestion.lo_id == lo_id)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(Question.question_text.ilike(pattern), Subject.subject_name.ilike(pattern)))
    if question_type:
        query = query.filter(Question.question_type == question_type)
    if difficulty:
        query = query.filter(Question.question_difficulties == difficulty)
    return query


def _list_questions(query, page: int, page_size: int) -> tuple[list[Question], int]:
    total = query.with_entities(func.count(func.distinct(Question.question_id))).scalar() or 0
    rows = (
        query.group_by(Question.question_id)
        .order_by(Question.question_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return rows, total


def _validate_taxonomy_for_payload(db: Session, payload: QuestionBankPayload, full_submit: bool) -> tuple[list[Chapter], list[LO]]:
    subject_id = payload.subject_id.strip() if payload.subject_id else None
    if not subject_id:
        raise HTTPException(status_code=400, detail="Subject is required")
    payload.subject_id = subject_id
    if not db.query(Subject).filter(Subject.subject_id == subject_id).first():
        raise HTTPException(status_code=404, detail="Subject not found")

    chapter_ids = list(dict.fromkeys(payload.chapter_ids))
    payload.chapter_ids = chapter_ids
    chapters = db.query(Chapter).filter(Chapter.chapter_id.in_(chapter_ids)).all() if chapter_ids else []
    if len(chapters) != len(chapter_ids):
        raise HTTPException(status_code=404, detail="One or more chapters were not found")
    if any(chapter.subject_id != subject_id for chapter in chapters):
        raise HTTPException(status_code=400, detail="Every selected chapter must belong to the question subject")

    lo_ids = list(dict.fromkeys(payload.lo_ids))
    payload.lo_ids = lo_ids
    if lo_ids and not chapter_ids:
        raise HTTPException(status_code=400, detail="Learning Objective cannot be selected without a Chapter")
    los = db.query(LO).filter(LO.lo_id.in_(lo_ids)).all() if lo_ids else []
    if len(los) != len(lo_ids):
        raise HTTPException(status_code=404, detail="One or more learning objectives were not found")
    if lo_ids:
        valid_query = (
            db.query(ChapterLO.lo_id)
            .join(Chapter, Chapter.chapter_id == ChapterLO.chapter_id)
            .filter(Chapter.subject_id == subject_id, ChapterLO.lo_id.in_(lo_ids))
        )
        if chapter_ids:
            valid_query = valid_query.filter(ChapterLO.chapter_id.in_(chapter_ids))
        valid_lo_ids = {row[0] for row in valid_query.all()}
        if valid_lo_ids != set(lo_ids):
            raise HTTPException(
                status_code=400,
                detail="Every selected learning objective must belong to the selected subject and chapters",
            )
    return chapters, los


def _validate_submit_payload(payload: QuestionBankPayload) -> None:
    if not payload.question_text.strip():
        raise HTTPException(status_code=400, detail="Question text is required")
    if payload.question_difficulties is None:
        raise HTTPException(status_code=400, detail="Difficulty is required when submitting for approval")
    non_empty = [option for option in payload.options if option.options_text.strip()]
    correct_count = sum(option.is_correct for option in non_empty)
    if payload.question_type == "MCQ":
        if len(non_empty) < 2:
            raise HTTPException(status_code=400, detail="MCQ questions require at least two non-empty options")
        if correct_count < 1:
            raise HTTPException(status_code=400, detail="MCQ questions require at least one correct option")
    elif payload.question_type == "true-false":
        normalized = {option.options_text.strip().lower() for option in non_empty}
        if len(non_empty) != 2 or normalized != {"true", "false"}:
            raise HTTPException(status_code=400, detail="True/false questions require exactly True and False options")
        if correct_count != 1:
            raise HTTPException(status_code=400, detail="True/false questions require exactly one correct option")
    elif non_empty:
        raise HTTPException(status_code=400, detail="Essay questions do not accept options")


def _payload_from_question(question: Question) -> QuestionBankPayload:
    return QuestionBankPayload(
        question_text=question.question_text,
        question_type=_value(question.question_type),
        question_difficulties=_value(question.question_difficulties) if question.question_difficulties else None,
        subject_id=question.subject_id,
        chapter_ids=[item.chapter_id for item in question.chapter_questions],
        lo_ids=[item.lo_id for item in question.lo_questions],
        options=[
            QuestionOptionPayload(options_id=option.options_id, options_text=option.options_text, is_correct=option.is_correct)
            for option in question.options
        ],
    )


def _replace_taxonomy(db: Session, question: Question, chapters: list[Chapter], los: list[LO]) -> None:
    db.query(ChapterQuestion).filter(ChapterQuestion.question_id == question.question_id).delete(synchronize_session=False)
    db.query(LOQuestion).filter(LOQuestion.question_id == question.question_id).delete(synchronize_session=False)
    db.flush()
    db.add_all(
        ChapterQuestion(chapter_id=chapter.chapter_id, question_id=question.question_id)
        for chapter in chapters
    )
    db.add_all(LOQuestion(lo_id=lo.lo_id, question_id=question.question_id) for lo in los)


def _replace_options(db: Session, question: Question, payload: QuestionBankPayload) -> None:
    existing = {option.options_id: option for option in question.options}
    requested = [option for option in payload.options if option.options_text.strip()]
    requested_ids = {option.options_id for option in requested if option.options_id is not None}
    unknown_ids = requested_ids - set(existing)
    if unknown_ids:
        raise HTTPException(status_code=400, detail="An option ID does not belong to this question")

    for option_id, option in existing.items():
        if option_id not in requested_ids:
            db.delete(option)
    for item in requested:
        option_text = item.options_text.strip()
        if item.options_id is None:
            db.add(Option(question_id=question.question_id, options_text=option_text, is_correct=item.is_correct))
        else:
            existing[item.options_id].options_text = option_text
            existing[item.options_id].is_correct = item.is_correct


def _snapshot_revision(db: Session, question: Question, edited_by: int) -> None:
    db.add(
        QuestionRevision(
            question_id=question.question_id,
            question_text=question.question_text,
            question_difficulties=_value(question.question_difficulties) if question.question_difficulties else None,
            question_type=_value(question.question_type) if question.question_type else None,
            subject_id=question.subject_id,
            question_status=_status(question),
            options_snapshot=[
                {
                    "options_id": option.options_id,
                    "options_text": option.options_text,
                    "is_correct": option.is_correct,
                }
                for option in sorted(question.options, key=lambda item: item.options_id)
            ],
            chapter_ids_snapshot=[item.chapter_id for item in question.chapter_questions],
            lo_ids_snapshot=[item.lo_id for item in question.lo_questions],
            edited_by=edited_by,
        )
    )


def _apply_payload(db: Session, question: Question, payload: QuestionBankPayload, chapters: list[Chapter], los: list[LO]) -> None:
    question.question_text = payload.question_text.strip()
    question.question_type = payload.question_type
    question.question_difficulties = payload.question_difficulties
    question.subject_id = payload.subject_id.strip() if payload.subject_id else None
    _replace_taxonomy(db, question, chapters, los)


def _owned_question(db: Session, question_id: int, teacher: User) -> Question:
    question = (
        _base_question_query(db)
        .filter(Question.question_id == question_id, Question.created_by == teacher.id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.get("")
def list_approved_question_bank(
    subject_id: str | None = None,
    chapter_id: int | None = None,
    lo_id: int | None = None,
    search: str | None = None,
    question_type: QuestionTypeLiteral | None = None,
    difficulty: QuestionDifficultyLiteral | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    query = _base_question_query(db).filter(Question.question_status == QuestionStatus.approved)
    query = _apply_filters(query, subject_id, chapter_id, lo_id, search, question_type, difficulty)
    questions, total = _list_questions(query, page, page_size)
    return {"items": [_serialize_item(item, teacher, bank=True) for item in questions], "total": total, "page": page, "page_size": page_size}


@router.get("/mine")
def list_my_questions(
    status_filter: Annotated[QuestionStatusLiteral | None, Query(alias="status")] = None,
    subject_id: str | None = None,
    chapter_id: int | None = None,
    lo_id: int | None = None,
    search: str | None = None,
    question_type: QuestionTypeLiteral | None = None,
    difficulty: QuestionDifficultyLiteral | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    query = _base_question_query(db).filter(Question.created_by == teacher.id)
    if status_filter:
        query = query.filter(Question.question_status == status_filter)
    query = _apply_filters(query, subject_id, chapter_id, lo_id, search, question_type, difficulty)
    questions, total = _list_questions(query, page, page_size)
    return {"items": [_serialize_item(item, teacher, bank=False) for item in questions], "total": total, "page": page, "page_size": page_size}


@router.get("/subjects")
def list_subject_counts(
    scope: Literal["bank", "mine"] = "bank",
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    filters = [Question.question_status == QuestionStatus.approved] if scope == "bank" else [Question.created_by == teacher.id]
    rows = (
        db.query(
            Subject.subject_id,
            Subject.subject_name,
            Subject.subject_description,
            func.count(Question.question_id).label("question_count"),
        )
        .outerjoin(Question, (Subject.subject_id == Question.subject_id) & filters[0])
        .group_by(Subject.subject_id, Subject.subject_name, Subject.subject_description)
        .order_by(Subject.subject_name)
        .all()
    )
    total = db.query(func.count(Question.question_id)).filter(*filters).scalar() or 0
    no_subject_count = 0
    if scope == "mine":
        no_subject_count = (
            db.query(func.count(Question.question_id))
            .filter(Question.created_by == teacher.id, Question.subject_id.is_(None))
            .scalar()
            or 0
        )
    return {
        "scope": scope,
        "total_count": total,
        "no_subject_count": no_subject_count,
        "subjects": [
            {
                "subject_id": row.subject_id,
                "subject_name": row.subject_name,
                "subject_description": row.subject_description,
                "question_count": row.question_count,
            }
            for row in rows
        ],
    }


@router.get("/subjects/{subject_id}/chapters")
def list_subject_chapters(
    subject_id: str,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del current_user, role_check
    chapters = db.query(Chapter).filter(Chapter.subject_id == subject_id).order_by(Chapter.chapter_name).all()
    return [{"chapter_id": chapter.chapter_id, "chapter_name": chapter.chapter_name} for chapter in chapters]


@router.get("/chapters/{chapter_id}/learning-objectives")
def list_chapter_learning_objectives(
    chapter_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del current_user, role_check
    rows = (
        db.query(LO)
        .join(ChapterLO, LO.lo_id == ChapterLO.lo_id)
        .filter(ChapterLO.chapter_id == chapter_id)
        .order_by(LO.lo_name)
        .all()
    )
    return [{"lo_id": item.lo_id, "lo_name": item.lo_name} for item in rows]


@router.get("/{question_id}")
def get_question_detail(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    question = _base_question_query(db).filter(Question.question_id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if _status(question) != "approved" and question.created_by != teacher.id:
        raise HTTPException(status_code=404, detail="Question not found")
    return _serialize_detail(question, teacher)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_draft_question(
    payload: QuestionBankPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        chapters, los = _validate_taxonomy_for_payload(db, payload, full_submit=False)
        question = Question(
            question_text=payload.question_text.strip(),
            question_type=payload.question_type,
            question_difficulties=payload.question_difficulties,
            subject_id=payload.subject_id.strip() if payload.subject_id else None,
            created_by=teacher.id,
            question_status=QuestionStatus.draft,
        )
        db.add(question)
        db.flush()
        _replace_taxonomy(db, question, chapters, los)
        _replace_options(db, question, payload)
        db.commit()
        db.expire_all()
        question = _base_question_query(db).filter(Question.question_id == question.question_id).first()
        return _serialize_detail(question, teacher)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question could not be created") from exc


@router.put("/{question_id}")
def update_question(
    question_id: int,
    payload: QuestionBankPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        question = _owned_question(db, question_id, teacher)
        question_status = _status(question)
        if question_status == "pending":
            raise HTTPException(status_code=409, detail="Pending questions are read-only")
        if question_status not in {"draft", "approved", "rejected"}:
            raise HTTPException(status_code=409, detail="Question cannot be edited")
        full_submit = question_status == "approved"
        if full_submit:
            _validate_submit_payload(payload)
        chapters, los = _validate_taxonomy_for_payload(db, payload, full_submit=full_submit)
        if question_status == "approved":
            _snapshot_revision(db, question, teacher.id)
        _apply_payload(db, question, payload, chapters, los)
        _replace_options(db, question, payload)
        if question_status == "approved":
            question.question_status = QuestionStatus.pending
        db.commit()
        db.expire_all()
        question = _base_question_query(db).filter(Question.question_id == question.question_id).first()
        return _serialize_detail(question, teacher)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question could not be updated") from exc


@router.post("/{question_id}/submit")
def submit_question(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        question = _owned_question(db, question_id, teacher)
        if _status(question) not in {"draft", "rejected"}:
            raise HTTPException(status_code=409, detail="Only draft or rejected questions can be submitted")
        payload = _payload_from_question(question)
        _validate_submit_payload(payload)
        _validate_taxonomy_for_payload(db, payload, full_submit=True)
        question.question_status = QuestionStatus.pending
        db.commit()
        db.expire_all()
        question = _base_question_query(db).filter(Question.question_id == question.question_id).first()
        return _serialize_detail(question, teacher)
    except HTTPException:
        db.rollback()
        raise


@router.delete("/{question_id}")
def delete_question(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        question = _owned_question(db, question_id, teacher)
        if _status(question) == "pending":
            raise HTTPException(status_code=409, detail="Pending questions cannot be deleted")
        if _status(question) not in {"draft", "rejected"}:
            raise HTTPException(status_code=409, detail="Only draft and rejected questions can be deleted")
        if db.query(ExamQuestion).filter(ExamQuestion.question_id == question.question_id).first():
            raise HTTPException(status_code=409, detail="Question is used by an exam and cannot be deleted")
        db.delete(question)
        db.commit()
        return {"success": True, "message": "Question deleted"}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question is referenced and cannot be deleted") from exc
