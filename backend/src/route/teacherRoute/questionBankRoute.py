from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased, selectinload

from database import get_db
from src.a_db_config import (
    AttemptQuestion,
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
    TeacherSubject,
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


def _status(question: Question) -> str | None:
    return _value(question.question_status) if question.question_status else None


def _revision_status(revision: QuestionRevision) -> str:
    return _value(revision.question_status)


def _assert_active_teacher(teacher: User) -> None:
    """Keep this compatible with the current schema and future account fields."""
    if getattr(teacher, "is_locked", False):
        raise HTTPException(status_code=403, detail="Teacher account is locked")
    if getattr(teacher, "deleted_at", None) is not None:
        raise HTTPException(status_code=403, detail="Teacher account has been deleted")


def _teacher(db: Session, school_id: str) -> User:
    teacher = db.query(User).filter(User.school_id == school_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if (_value(teacher.role) or "").lower() != "teacher":
        raise HTTPException(status_code=403, detail="Teacher role is required")
    _assert_active_teacher(teacher)
    return teacher


def _active_subject_ids(db: Session, teacher_id: int) -> set[str]:
    return {
        row[0]
        for row in db.query(TeacherSubject.subject_id)
        .filter(TeacherSubject.teacher_id == teacher_id, TeacherSubject.is_active.is_(True))
        .all()
    }


def _require_subject_permission(db: Session, teacher: User, subject_id: str | None) -> None:
    if not subject_id or subject_id not in _active_subject_ids(db, teacher.id):
        raise HTTPException(status_code=403, detail="You do not have an active permission for this subject")


def _subject_summary(subject: Subject | None) -> dict | None:
    if not subject:
        return None
    return {"subject_id": subject.subject_id, "subject_name": subject.subject_name}


def _chapter_summary(link: ChapterQuestion) -> dict:
    return {"chapter_id": link.chapter.chapter_id, "chapter_name": link.chapter.chapter_name}


def _lo_summary(link: LOQuestion) -> dict:
    return {"lo_id": link.lo.lo_id, "lo_name": link.lo.lo_name}


def _revision_metadata(db: Session, question_id: int, teacher_id: int) -> dict:
    revisions = (
        db.query(QuestionRevision)
        .filter(QuestionRevision.question_id == question_id, QuestionRevision.edited_by == teacher_id)
        .order_by(QuestionRevision.version_number.desc(), QuestionRevision.revision_id.desc())
        .all()
    )
    latest = revisions[0] if revisions else None
    pending = latest if latest and _revision_status(latest) == "pending" else None
    rejected = latest if latest and _revision_status(latest) == "rejected" else None
    return {
        "has_pending_revision": pending is not None,
        "pending_revision_id": pending.revision_id if pending else None,
        "pending_version_number": pending.version_number if pending else None,
        "pending_updated_at": pending.updated_at.isoformat() if pending and pending.updated_at else None,
        "latest_rejected_revision_id": rejected.revision_id if rejected else None,
        "revision_rejection_reason": rejected.rejection_reason if rejected else None,
    }


def _permission_flags(question: Question, teacher: User, bank: bool, can_manage_subject: bool, has_pending_revision: bool) -> dict:
    owner = question.created_by == teacher.id
    question_status = _status(question)
    can_propose_approved_edit = can_manage_subject and question_status == "approved"
    can_manage_private_question = not bank and owner and can_manage_subject and question_status in {"draft", "pending", "rejected"}
    return {
        "can_view": question_status == "approved" or owner,
        "can_edit": can_propose_approved_edit or can_manage_private_question,
        "can_delete": can_manage_private_question,
        "can_submit": can_manage_private_question and question_status == "draft",
        "can_resubmit": can_manage_private_question and question_status == "rejected",
        "can_delete_pending_revision": can_propose_approved_edit and has_pending_revision,
    }


def _serialize_item(question: Question, teacher: User, bank: bool, db: Session, subject_ids: set[str] | None = None) -> dict:
    subject_ids = subject_ids if subject_ids is not None else _active_subject_ids(db, teacher.id)
    revision_data = _revision_metadata(db, question.question_id, teacher.id)
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
        "permissions": _permission_flags(
            question,
            teacher,
            bank,
            question.subject_id in subject_ids,
            revision_data["has_pending_revision"],
        ),
        **revision_data,
    }


def _serialize_detail(question: Question, teacher: User, db: Session) -> dict:
    data = _serialize_item(question, teacher, bank=False, db=db)
    data.update(
        {
            "created_by": question.created_by,
            "creator": (
                {"id": question.creator.id, "school_id": question.creator.school_id, "full_name": question.creator.full_name}
                if question.creator
                else None
            ),
            "options": [
                {"options_id": option.options_id, "options_text": option.options_text, "is_correct": option.is_correct}
                for option in sorted(question.options, key=lambda item: item.options_id)
            ],
            "rejected_feedback": data["revision_rejection_reason"],
        }
    )
    return data


def _serialize_edit_question(question: Question) -> dict:
    return {
        "question_id": question.question_id,
        "revision_id": None,
        "version_number": None,
        "question_status": _status(question),
        "question_text": question.question_text,
        "question_type": _value(question.question_type),
        "question_difficulties": _value(question.question_difficulties) if question.question_difficulties else None,
        "subject_id": question.subject_id,
        "options": [
            {"options_id": option.options_id, "options_text": option.options_text, "is_correct": option.is_correct}
            for option in sorted(question.options, key=lambda item: item.options_id)
        ],
        "chapter_ids": [item.chapter_id for item in question.chapter_questions],
        "lo_ids": [item.lo_id for item in question.lo_questions],
        "has_pending_revision": False,
        "rejection_reason": None,
        "created_at": None,
        "updated_at": None,
    }


def _serialize_edit_revision(revision: QuestionRevision, has_pending_revision: bool = True) -> dict:
    return {
        "question_id": revision.question_id,
        "revision_id": revision.revision_id,
        "version_number": revision.version_number,
        "question_status": _revision_status(revision),
        "question_text": revision.question_text,
        "question_type": revision.question_type,
        "question_difficulties": revision.question_difficulties,
        "subject_id": revision.subject_id,
        "options": revision.options_snapshot or [],
        "chapter_ids": revision.chapter_ids_snapshot or [],
        "lo_ids": revision.lo_ids_snapshot or [],
        "has_pending_revision": has_pending_revision,
        "rejection_reason": revision.rejection_reason,
        "created_at": revision.created_at.isoformat() if revision.created_at else None,
        "updated_at": revision.updated_at.isoformat() if revision.updated_at else None,
    }


def _base_question_query(db: Session):
    return db.query(Question).options(
        selectinload(Question.subject),
        selectinload(Question.creator),
        selectinload(Question.options),
        selectinload(Question.exam_questions),
        selectinload(Question.chapter_questions).selectinload(ChapterQuestion.chapter),
        selectinload(Question.lo_questions).selectinload(LOQuestion.lo),
    )


def _apply_filters(query, subject_id, chapter_id, lo_id, search, question_type, difficulty):
    query = query.outerjoin(Subject, Question.subject_id == Subject.subject_id)
    if subject_id == "__none__":
        query = query.filter(Question.subject_id.is_(None))
    elif subject_id:
        query = query.filter(Question.subject_id == subject_id)
    if chapter_id is not None:
        query = query.join(ChapterQuestion, Question.question_id == ChapterQuestion.question_id).filter(ChapterQuestion.chapter_id == chapter_id)
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
    rows = query.group_by(Question.question_id).order_by(Question.question_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return rows, total


def _validate_taxonomy_for_payload(db: Session, payload: QuestionBankPayload) -> tuple[list[Chapter], list[LO]]:
    subject_id = payload.subject_id.strip() if payload.subject_id else None
    if not subject_id:
        raise HTTPException(status_code=400, detail="Subject is required")
    payload.subject_id = subject_id
    if not db.query(Subject).filter(Subject.subject_id == subject_id).first():
        raise HTTPException(status_code=404, detail="Subject not found")
    payload.chapter_ids = list(dict.fromkeys(payload.chapter_ids))
    chapters = db.query(Chapter).filter(Chapter.chapter_id.in_(payload.chapter_ids)).all() if payload.chapter_ids else []
    if len(chapters) != len(payload.chapter_ids):
        raise HTTPException(status_code=404, detail="One or more chapters were not found")
    if any(chapter.subject_id != subject_id for chapter in chapters):
        raise HTTPException(status_code=400, detail="Every selected chapter must belong to the question subject")
    payload.lo_ids = list(dict.fromkeys(payload.lo_ids))
    if payload.lo_ids and not payload.chapter_ids:
        raise HTTPException(status_code=400, detail="Learning Objective cannot be selected without a Chapter")
    los = db.query(LO).filter(LO.lo_id.in_(payload.lo_ids)).all() if payload.lo_ids else []
    if len(los) != len(payload.lo_ids):
        raise HTTPException(status_code=404, detail="One or more learning objectives were not found")
    if payload.lo_ids:
        valid_lo_ids = {
            row[0]
            for row in db.query(ChapterLO.lo_id)
            .join(Chapter, Chapter.chapter_id == ChapterLO.chapter_id)
            .filter(Chapter.subject_id == subject_id, ChapterLO.chapter_id.in_(payload.chapter_ids), ChapterLO.lo_id.in_(payload.lo_ids))
            .all()
        }
        if valid_lo_ids != set(payload.lo_ids):
            raise HTTPException(status_code=400, detail="Every selected learning objective must belong to the selected subject and chapters")
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
        options=[QuestionOptionPayload(options_id=item.options_id, options_text=item.options_text, is_correct=item.is_correct) for item in question.options],
    )


def _payload_from_revision(revision: QuestionRevision) -> QuestionBankPayload:
    return QuestionBankPayload(
        question_text=revision.question_text,
        question_type=revision.question_type,
        question_difficulties=revision.question_difficulties,
        subject_id=revision.subject_id,
        chapter_ids=revision.chapter_ids_snapshot or [],
        lo_ids=revision.lo_ids_snapshot or [],
        options=[QuestionOptionPayload(**item) for item in revision.options_snapshot or []],
    )


def _replace_taxonomy(db: Session, question: Question, chapters: list[Chapter], los: list[LO]) -> None:
    db.query(ChapterQuestion).filter(ChapterQuestion.question_id == question.question_id).delete(synchronize_session=False)
    db.query(LOQuestion).filter(LOQuestion.question_id == question.question_id).delete(synchronize_session=False)
    db.flush()
    db.expire(question, ["chapter_questions", "lo_questions"])
    db.add_all(ChapterQuestion(chapter_id=item.chapter_id, question_id=question.question_id) for item in chapters)
    db.add_all(LOQuestion(lo_id=item.lo_id, question_id=question.question_id) for item in los)


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
        if item.options_id is None:
            db.add(Option(question_id=question.question_id, options_text=item.options_text.strip(), is_correct=item.is_correct))
        else:
            existing[item.options_id].options_text = item.options_text.strip()
            existing[item.options_id].is_correct = item.is_correct


def _apply_payload(question: Question, payload: QuestionBankPayload) -> None:
    question.question_text = payload.question_text.strip()
    question.question_type = payload.question_type
    question.question_difficulties = payload.question_difficulties
    question.subject_id = payload.subject_id.strip() if payload.subject_id else None


def _revision_values(payload: QuestionBankPayload) -> dict:
    return {
        "question_text": payload.question_text.strip(),
        "question_type": payload.question_type,
        "question_difficulties": payload.question_difficulties,
        "subject_id": payload.subject_id.strip() if payload.subject_id else None,
        "options_snapshot": [
            {"options_id": item.options_id, "options_text": item.options_text.strip(), "is_correct": item.is_correct}
            for item in payload.options
            if item.options_text.strip()
        ],
        "chapter_ids_snapshot": list(payload.chapter_ids),
        "lo_ids_snapshot": list(payload.lo_ids),
    }


def _locked_question(db: Session, question_id: int) -> Question:
    question = _base_question_query(db).populate_existing().filter(Question.question_id == question_id).with_for_update().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


def _locked_owned_question(db: Session, question_id: int, teacher: User) -> Question:
    question = _locked_question(db, question_id)
    if question.created_by != teacher.id:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


def _refresh_question(db: Session, question_id: int) -> Question:
    question = _base_question_query(db).populate_existing().filter(Question.question_id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


def _ensure_direct_question_write(
    db: Session,
    teacher: User,
    question: Question,
    payload: QuestionBankPayload,
    full_validation: bool,
) -> tuple[list[Chapter], list[LO]]:
    _require_subject_permission(db, teacher, question.subject_id)
    _require_subject_permission(db, teacher, payload.subject_id)
    chapters, los = _validate_taxonomy_for_payload(db, payload)
    if full_validation:
        _validate_submit_payload(payload)
    return chapters, los


@router.get("")
def list_approved_question_bank(
    subject_id: str | None = None, chapter_id: int | None = None, lo_id: int | None = None, search: str | None = None,
    question_type: QuestionTypeLiteral | None = None, difficulty: QuestionDifficultyLiteral | None = None,
    page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY), db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    subject_ids = _active_subject_ids(db, teacher.id)
    query = _apply_filters(_base_question_query(db).filter(Question.question_status == QuestionStatus.approved), subject_id, chapter_id, lo_id, search, question_type, difficulty)
    questions, total = _list_questions(query, page, page_size)
    return {"items": [_serialize_item(item, teacher, True, db, subject_ids) for item in questions], "total": total, "page": page, "page_size": page_size}


@router.get("/mine")
def list_my_questions(
    status_filter: Annotated[QuestionStatusLiteral | None, Query(alias="status")] = None,
    subject_id: str | None = None, chapter_id: int | None = None, lo_id: int | None = None, search: str | None = None,
    question_type: QuestionTypeLiteral | None = None, difficulty: QuestionDifficultyLiteral | None = None,
    page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY), db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    subject_ids = _active_subject_ids(db, teacher.id)
    query = _base_question_query(db).filter(Question.created_by == teacher.id)
    if status_filter:
        pending_revision_exists = db.query(QuestionRevision.revision_id).filter(
            QuestionRevision.question_id == Question.question_id,
            QuestionRevision.edited_by == teacher.id,
            QuestionRevision.question_status == "pending",
        ).exists()
        rejected_revision = aliased(QuestionRevision)
        newer_revision = aliased(QuestionRevision)
        latest_rejected_revision_exists = db.query(rejected_revision.revision_id).filter(
            rejected_revision.question_id == Question.question_id,
            rejected_revision.edited_by == teacher.id,
            rejected_revision.question_status == "rejected",
            ~db.query(newer_revision.revision_id).filter(
                newer_revision.question_id == rejected_revision.question_id,
                newer_revision.edited_by == teacher.id,
                newer_revision.version_number > rejected_revision.version_number,
            ).exists(),
        ).exists()
        if status_filter == "pending":
            query = query.filter(
                or_(
                    Question.question_status == QuestionStatus.pending,
                    and_(Question.question_status == QuestionStatus.approved, pending_revision_exists),
                )
            )
        elif status_filter == "approved":
            query = query.filter(
                Question.question_status == QuestionStatus.approved,
                ~pending_revision_exists,
                ~latest_rejected_revision_exists,
            )
        elif status_filter == "rejected":
            query = query.filter(
                or_(
                    Question.question_status == QuestionStatus.rejected,
                    and_(
                        Question.question_status == QuestionStatus.approved,
                        ~pending_revision_exists,
                        latest_rejected_revision_exists,
                    ),
                )
            )
        else:
            query = query.filter(Question.question_status == status_filter)
    query = _apply_filters(query, subject_id, chapter_id, lo_id, search, question_type, difficulty)
    questions, total = _list_questions(query, page, page_size)
    return {"items": [_serialize_item(item, teacher, False, db, subject_ids) for item in questions], "total": total, "page": page, "page_size": page_size}


@router.get("/subjects")
def list_subject_counts(scope: Literal["bank", "mine"] = "bank", current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    filters = [Question.question_status == QuestionStatus.approved] if scope == "bank" else [Question.created_by == teacher.id]
    rows = db.query(Subject.subject_id, Subject.subject_name, Subject.subject_description, func.count(Question.question_id).label("question_count")).outerjoin(Question, (Subject.subject_id == Question.subject_id) & filters[0]).group_by(Subject.subject_id, Subject.subject_name, Subject.subject_description).order_by(Subject.subject_name).all()
    total = db.query(func.count(Question.question_id)).filter(*filters).scalar() or 0
    no_subject_count = db.query(func.count(Question.question_id)).filter(Question.created_by == teacher.id, Question.subject_id.is_(None)).scalar() or 0 if scope == "mine" else 0
    return {"scope": scope, "total_count": total, "no_subject_count": no_subject_count, "subjects": [{"subject_id": row.subject_id, "subject_name": row.subject_name, "subject_description": row.subject_description, "question_count": row.question_count} for row in rows]}


@router.get("/subjects/{subject_id}/chapters")
def list_subject_chapters(subject_id: str, current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    del role_check
    _teacher(db, current_user["school_id"])
    return [{"chapter_id": item.chapter_id, "chapter_name": item.chapter_name} for item in db.query(Chapter).filter(Chapter.subject_id == subject_id).order_by(Chapter.chapter_name).all()]


@router.get("/chapters/{chapter_id}/learning-objectives")
def list_chapter_learning_objectives(chapter_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    del role_check
    _teacher(db, current_user["school_id"])
    return [{"lo_id": item.lo_id, "lo_name": item.lo_name} for item in db.query(LO).join(ChapterLO, LO.lo_id == ChapterLO.lo_id).filter(ChapterLO.chapter_id == chapter_id).order_by(LO.lo_name).all()]


@router.get("/{question_id}/edit")
def get_question_edit_payload(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
    revision_id: int | None = Query(default=None, ge=1),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    question = _refresh_question(db, question_id)
    question_status = _status(question)
    if question_status != "approved" and question.created_by != teacher.id:
        raise HTTPException(status_code=404, detail="Question not found")
    _require_subject_permission(db, teacher, question.subject_id)
    if isinstance(revision_id, int):
        revision = db.query(QuestionRevision).filter(
            QuestionRevision.revision_id == revision_id,
            QuestionRevision.question_id == question_id,
            QuestionRevision.edited_by == teacher.id,
        ).first()
        if not revision:
            raise HTTPException(status_code=404, detail="Question revision not found")
        _require_subject_permission(db, teacher, revision.subject_id)
        return _serialize_edit_revision(revision, _revision_status(revision) == "pending")
    if question_status == "pending":
        return _serialize_edit_question(question)
    if question_status == "approved":
        latest_revision = db.query(QuestionRevision).filter(
            QuestionRevision.question_id == question_id,
            QuestionRevision.edited_by == teacher.id,
            QuestionRevision.question_status.in_(["pending", "rejected"]),
        ).order_by(QuestionRevision.version_number.desc(), QuestionRevision.revision_id.desc()).first()
        if latest_revision:
            _require_subject_permission(db, teacher, latest_revision.subject_id)
            return _serialize_edit_revision(latest_revision, _revision_status(latest_revision) == "pending")
    return _serialize_edit_question(question)


@router.get("/{question_id}")
def get_question_detail(question_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    question = _refresh_question(db, question_id)
    if _status(question) != "approved" and question.created_by != teacher.id:
        raise HTTPException(status_code=404, detail="Question not found")
    return _serialize_detail(question, teacher, db)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_draft_question(payload: QuestionBankPayload, current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        _require_subject_permission(db, teacher, payload.subject_id)
        chapters, los = _validate_taxonomy_for_payload(db, payload)
        question = Question(question_text=payload.question_text.strip(), question_type=payload.question_type, question_difficulties=payload.question_difficulties, subject_id=payload.subject_id, created_by=teacher.id, question_status=QuestionStatus.draft)
        db.add(question)
        db.flush()
        _replace_taxonomy(db, question, chapters, los)
        _replace_options(db, question, payload)
        db.commit()
        return _serialize_detail(_refresh_question(db, question.question_id), teacher, db)
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
    expected_status: QuestionStatusLiteral | None = Query(default=None),
):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        question = _locked_question(db, question_id)
        question_status = _status(question)
        if isinstance(expected_status, str) and question_status != expected_status:
            raise HTTPException(status_code=409, detail="Question status changed before the update could be applied")
        if question_status in {"draft", "pending", "rejected"}:
            if question.created_by != teacher.id:
                raise HTTPException(status_code=404, detail="Question not found")
            chapters, los = _ensure_direct_question_write(db, teacher, question, payload, question_status == "pending")
            _apply_payload(question, payload)
            _replace_taxonomy(db, question, chapters, los)
            _replace_options(db, question, payload)
        elif question_status == "approved":
            _require_subject_permission(db, teacher, question.subject_id)
            _require_subject_permission(db, teacher, payload.subject_id)
            _validate_taxonomy_for_payload(db, payload)
            _validate_submit_payload(payload)
            pending = db.query(QuestionRevision).filter(QuestionRevision.question_id == question.question_id, QuestionRevision.edited_by == teacher.id, QuestionRevision.question_status == "pending").with_for_update().first()
            values = _revision_values(payload)
            if pending:
                for key, value in values.items():
                    setattr(pending, key, value)
                pending.updated_at = datetime.now()
            else:
                next_version = (db.query(func.max(QuestionRevision.version_number)).filter(QuestionRevision.question_id == question.question_id).scalar() or 0) + 1
                db.add(QuestionRevision(question_id=question.question_id, version_number=next_version, question_status="pending", edited_by=teacher.id, approved_by=None, approved_at=None, rejection_reason=None, **values))
        else:
            raise HTTPException(status_code=409, detail="Question cannot be edited")
        db.commit()
        db.expire_all()
        return _serialize_detail(_refresh_question(db, question_id), teacher, db)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question could not be updated because it changed concurrently") from exc


@router.post("/{question_id}/submit")
def submit_question(question_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        question = _locked_owned_question(db, question_id, teacher)
        if _status(question) not in {"draft", "rejected"}:
            raise HTTPException(status_code=409, detail="Only draft or rejected questions can be submitted")
        _require_subject_permission(db, teacher, question.subject_id)
        payload = _payload_from_question(question)
        _validate_taxonomy_for_payload(db, payload)
        _validate_submit_payload(payload)
        question.question_status = QuestionStatus.pending
        db.commit()
        return _serialize_detail(_refresh_question(db, question_id), teacher, db)
    except HTTPException:
        db.rollback()
        raise


def _ensure_question_can_be_deleted(db: Session, question: Question) -> None:
    if db.query(QuestionRevision.revision_id).filter(QuestionRevision.question_id == question.question_id).first():
        raise HTTPException(status_code=409, detail="Question history exists and cannot be deleted")
    if db.query(ExamQuestion.question_id).filter(ExamQuestion.question_id == question.question_id).first():
        raise HTTPException(status_code=409, detail="Question is used by an exam and cannot be deleted")
    if db.query(AttemptQuestion.question_id).filter(AttemptQuestion.question_id == question.question_id).first():
        raise HTTPException(status_code=409, detail="Question is referenced by an attempt and cannot be deleted")


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
    expected_status: QuestionStatusLiteral | None = Query(default=None),
):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        question = _locked_owned_question(db, question_id, teacher)
        question_status = _status(question)
        if isinstance(expected_status, str) and question_status != expected_status:
            raise HTTPException(status_code=409, detail="Question status changed before the delete could be applied")
        if question_status not in {"draft", "pending", "rejected"}:
            raise HTTPException(status_code=409, detail="Only draft, pending, and rejected questions can be deleted")
        _require_subject_permission(db, teacher, question.subject_id)
        _ensure_question_can_be_deleted(db, question)
        db.query(Option).filter(Option.question_id == question.question_id).delete(synchronize_session=False)
        db.query(ChapterQuestion).filter(ChapterQuestion.question_id == question.question_id).delete(synchronize_session=False)
        db.query(LOQuestion).filter(LOQuestion.question_id == question.question_id).delete(synchronize_session=False)
        db.flush()
        db.expire(question, ["options", "chapter_questions", "lo_questions"])
        db.delete(question)
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question is referenced and cannot be deleted") from exc


@router.delete("/{question_id}/pending-revision", status_code=status.HTTP_204_NO_CONTENT)
def delete_pending_revision(question_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        question = _locked_question(db, question_id)
        if _status(question) != "approved":
            raise HTTPException(status_code=409, detail="Active question is no longer approved")
        pending = db.query(QuestionRevision).filter(QuestionRevision.question_id == question_id, QuestionRevision.edited_by == teacher.id, QuestionRevision.question_status == "pending").with_for_update().first()
        if not pending:
            latest = db.query(QuestionRevision).filter(QuestionRevision.question_id == question_id, QuestionRevision.edited_by == teacher.id).order_by(QuestionRevision.version_number.desc()).first()
            if latest:
                raise HTTPException(status_code=409, detail="Pending revision is no longer pending")
            raise HTTPException(status_code=404, detail="Pending revision not found")
        _require_subject_permission(db, teacher, pending.subject_id)
        db.delete(pending)
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Pending revision could not be deleted") from exc
