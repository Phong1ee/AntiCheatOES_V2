from datetime import date, datetime
import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from database import get_db
from src.a_db_config import (
    Attempt,
    AttemptQuestion,
    Chapter,
    ChapterLO,
    ChapterQuestion,
    LO,
    LOQuestion,
    MCQAnswer,
    Option,
    Question,
    QuestionRevision,
    QuestionStatus,
    Subject,
    TeacherSubject,
    User,
    UserRole,
)
from src.middleware.authMiddleware import ADMIN_ONLY, verify_token
from werkzeug.security import check_password_hash, generate_password_hash


router = APIRouter()

QuestionTypeLiteral = Literal["MCQ", "essay", "true-false"]
QuestionDifficultyLiteral = Literal["easy", "medium", "hard"]


class RejectPayload(BaseModel):
    reason: str = Field(max_length=500)


class RevisionOptionPayload(BaseModel):
    options_id: int | None = None
    options_text: str = ""
    is_correct: bool = False


class RevisionSnapshotPayload(BaseModel):
    question_text: str = Field(min_length=1, max_length=255)
    question_type: QuestionTypeLiteral
    question_difficulties: QuestionDifficultyLiteral | None = None
    subject_id: str | None = Field(default=None, max_length=20)
    chapter_ids: list[int] = Field(default_factory=list)
    lo_ids: list[int] = Field(default_factory=list)
    options: list[RevisionOptionPayload] = Field(default_factory=list)


def _value(item):
    return item.value if hasattr(item, "value") else item


def _question_status(question: Question) -> str | None:
    return _value(question.question_status) if question.question_status else None


def _revision_status(revision: QuestionRevision) -> str:
    return _value(revision.question_status)


def _admin(db: Session, school_id: str) -> User:
    admin = db.query(User).filter(User.school_id == school_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    if (_value(admin.role) or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin role is required")
    if getattr(admin, "is_locked", False):
        raise HTTPException(status_code=403, detail="Admin account is locked")
    if getattr(admin, "deleted_at", None) is not None:
        raise HTTPException(status_code=403, detail="Admin account has been deleted")
    return admin


def _user_summary(user: User | None) -> dict | None:
    if not user:
        return None
    return {"id": user.id, "school_id": user.school_id, "full_name": user.full_name}


def _subject_summary(subject: Subject | None) -> dict | None:
    if not subject:
        return None
    return {"subject_id": subject.subject_id, "subject_name": subject.subject_name}


def _question_options(question: Question) -> list[dict]:
    return [
        {"options_id": option.options_id, "options_text": option.options_text, "is_correct": option.is_correct}
        for option in sorted(question.options, key=lambda item: item.options_id)
    ]


def _question_chapters(question: Question) -> list[dict]:
    return [
        {"chapter_id": link.chapter.chapter_id, "chapter_name": link.chapter.chapter_name}
        for link in question.chapter_questions
    ]


def _question_los(question: Question) -> list[dict]:
    return [{"lo_id": link.lo.lo_id, "lo_name": link.lo.lo_name} for link in question.lo_questions]


def _serialize_question(question: Question, include_options: bool = True) -> dict:
    data = {
        "question_id": question.question_id,
        "question_text": question.question_text,
        "question_type": _value(question.question_type),
        "question_difficulties": _value(question.question_difficulties) if question.question_difficulties else None,
        "question_status": _question_status(question),
        "subject": _subject_summary(question.subject),
        "teacher": _user_summary(question.creator),
        "chapters": _question_chapters(question),
        "learning_objectives": _question_los(question),
        "created_at": getattr(question, "created_at", None).isoformat() if getattr(question, "created_at", None) else None,
        "updated_at": getattr(question, "updated_at", None).isoformat() if getattr(question, "updated_at", None) else None,
    }
    if include_options:
        data["options"] = _question_options(question)
    return data


def _snapshot_chapters(db: Session, chapter_ids: list[int]) -> list[dict]:
    if not chapter_ids:
        return []
    chapters = {chapter.chapter_id: chapter for chapter in db.query(Chapter).filter(Chapter.chapter_id.in_(chapter_ids)).all()}
    return [
        {"chapter_id": chapter_id, "chapter_name": chapters[chapter_id].chapter_name if chapter_id in chapters else None}
        for chapter_id in chapter_ids
    ]


def _snapshot_los(db: Session, lo_ids: list[int]) -> list[dict]:
    if not lo_ids:
        return []
    los = {lo.lo_id: lo for lo in db.query(LO).filter(LO.lo_id.in_(lo_ids)).all()}
    return [{"lo_id": lo_id, "lo_name": los[lo_id].lo_name if lo_id in los else None} for lo_id in lo_ids]


def _serialize_snapshot(revision: QuestionRevision, db: Session) -> dict:
    chapter_ids = revision.chapter_ids_snapshot or []
    lo_ids = revision.lo_ids_snapshot or []
    subject = db.query(Subject).filter(Subject.subject_id == revision.subject_id).first() if revision.subject_id else None
    return {
        "revision_id": revision.revision_id,
        "question_id": revision.question_id,
        "version_number": revision.version_number,
        "question_text": revision.question_text,
        "question_type": revision.question_type,
        "question_difficulties": revision.question_difficulties,
        "subject_id": revision.subject_id,
        "subject": _subject_summary(subject),
        "question_status": _revision_status(revision),
        "options": revision.options_snapshot or [],
        "chapter_ids": chapter_ids,
        "chapters": _snapshot_chapters(db, chapter_ids),
        "lo_ids": lo_ids,
        "learning_objectives": _snapshot_los(db, lo_ids),
        "editor": _user_summary(revision.editor),
        "approved_by": _user_summary(revision.approver),
        "approved_at": revision.approved_at.isoformat() if revision.approved_at else None,
        "rejection_reason": revision.rejection_reason,
        "created_at": revision.created_at.isoformat() if revision.created_at else None,
        "updated_at": revision.updated_at.isoformat() if revision.updated_at else None,
    }


def _question_query(db: Session):
    return db.query(Question).options(
        selectinload(Question.subject),
        selectinload(Question.creator),
        selectinload(Question.options),
        selectinload(Question.chapter_questions).selectinload(ChapterQuestion.chapter),
        selectinload(Question.lo_questions).selectinload(LOQuestion.lo),
    )


def _revision_query(db: Session):
    return db.query(QuestionRevision).options(
        selectinload(QuestionRevision.editor),
        selectinload(QuestionRevision.approver),
        selectinload(QuestionRevision.question).selectinload(Question.subject),
        selectinload(QuestionRevision.question).selectinload(Question.creator),
        selectinload(QuestionRevision.question).selectinload(Question.options),
        selectinload(QuestionRevision.question).selectinload(Question.chapter_questions).selectinload(ChapterQuestion.chapter),
        selectinload(QuestionRevision.question).selectinload(Question.lo_questions).selectinload(LOQuestion.lo),
    )


def _locked_question(db: Session, question_id: int) -> Question:
    question = _question_query(db).populate_existing().filter(Question.question_id == question_id).with_for_update().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


def _locked_revision(db: Session, revision_id: int) -> QuestionRevision:
    revision = _revision_query(db).populate_existing().filter(QuestionRevision.revision_id == revision_id).with_for_update().first()
    if not revision:
        raise HTTPException(status_code=404, detail="Question revision not found")
    return revision


def _validated_reason(payload: RejectPayload) -> str:
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    return reason


def _snapshot_from_question(question: Question) -> dict:
    return {
        "question_text": question.question_text,
        "question_type": _value(question.question_type),
        "question_difficulties": _value(question.question_difficulties) if question.question_difficulties else None,
        "subject_id": question.subject_id,
        "options_snapshot": _question_options(question),
        "chapter_ids_snapshot": [link.chapter_id for link in question.chapter_questions],
        "lo_ids_snapshot": [link.lo_id for link in question.lo_questions],
    }


def _payload_from_question(question: Question) -> RevisionSnapshotPayload:
    return RevisionSnapshotPayload(
        question_text=question.question_text,
        question_type=_value(question.question_type),
        question_difficulties=_value(question.question_difficulties) if question.question_difficulties else None,
        subject_id=question.subject_id,
        options=_question_options(question),
        chapter_ids=[link.chapter_id for link in question.chapter_questions],
        lo_ids=[link.lo_id for link in question.lo_questions],
    )


def _snapshot_payload(revision: QuestionRevision) -> RevisionSnapshotPayload:
    try:
        return RevisionSnapshotPayload(
            question_text=revision.question_text,
            question_type=revision.question_type,
            question_difficulties=revision.question_difficulties,
            subject_id=revision.subject_id,
            chapter_ids=revision.chapter_ids_snapshot or [],
            lo_ids=revision.lo_ids_snapshot or [],
            options=revision.options_snapshot or [],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Pending revision snapshot is invalid") from exc


def _validate_snapshot(db: Session, payload: RevisionSnapshotPayload) -> tuple[list[Chapter], list[LO]]:
    payload.question_text = payload.question_text.strip()
    subject_id = payload.subject_id.strip() if payload.subject_id else None
    if not payload.question_text:
        raise HTTPException(status_code=400, detail="Question text is required")
    if not subject_id:
        raise HTTPException(status_code=400, detail="Subject is required")
    payload.subject_id = subject_id
    if not db.query(Subject.subject_id).filter(Subject.subject_id == subject_id).first():
        raise HTTPException(status_code=404, detail="Subject not found")
    if payload.question_difficulties is None:
        raise HTTPException(status_code=400, detail="Difficulty is required")

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
            .filter(
                Chapter.subject_id == subject_id,
                ChapterLO.chapter_id.in_(payload.chapter_ids),
                ChapterLO.lo_id.in_(payload.lo_ids),
            )
            .all()
        }
        if valid_lo_ids != set(payload.lo_ids):
            raise HTTPException(status_code=400, detail="Every selected learning objective must belong to the selected subject and chapters")

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
    return chapters, los


def _replace_taxonomy(db: Session, question: Question, chapters: list[Chapter], los: list[LO]) -> None:
    db.query(ChapterQuestion).filter(ChapterQuestion.question_id == question.question_id).delete(synchronize_session=False)
    db.query(LOQuestion).filter(LOQuestion.question_id == question.question_id).delete(synchronize_session=False)
    db.flush()
    db.expire(question, ["chapter_questions", "lo_questions"])
    db.add_all(ChapterQuestion(question_id=question.question_id, chapter_id=chapter.chapter_id) for chapter in chapters)
    db.add_all(LOQuestion(question_id=question.question_id, lo_id=lo.lo_id) for lo in los)


def _replace_options(db: Session, question: Question, payload: RevisionSnapshotPayload) -> None:
    existing = {option.options_id: option for option in question.options}
    requested = [option for option in payload.options if option.options_text.strip()]
    requested_ids = [option.options_id for option in requested if option.options_id is not None]
    if len(requested_ids) != len(set(requested_ids)):
        raise HTTPException(status_code=400, detail="An option ID was supplied more than once")
    unknown_ids = set(requested_ids) - set(existing)
    if unknown_ids:
        raise HTTPException(status_code=400, detail="An option ID does not belong to this question")

    deleted_ids = set(existing) - set(requested_ids)
    if deleted_ids and (
        db.query(AttemptQuestion)
        .join(Attempt, Attempt.attempt_id == AttemptQuestion.attempt_id)
        .filter(AttemptQuestion.question_id == question.question_id, Attempt.status == "in_progress")
        .first()
    ):
        raise HTTPException(status_code=409, detail="Options cannot be removed while an attempt is in progress")
    if deleted_ids and db.query(MCQAnswer.mcq_answer_id).filter(MCQAnswer.selected_option_id.in_(deleted_ids)).first():
        raise HTTPException(status_code=409, detail="An option is already used by an attempt and cannot be removed")

    for option_id in deleted_ids:
        db.delete(existing[option_id])
    for item in requested:
        if item.options_id is None:
            db.add(Option(question_id=question.question_id, options_text=item.options_text.strip(), is_correct=item.is_correct))
        else:
            existing[item.options_id].options_text = item.options_text.strip()
            existing[item.options_id].is_correct = item.is_correct


def _apply_snapshot(question: Question, payload: RevisionSnapshotPayload) -> None:
    question.question_text = payload.question_text.strip()
    question.question_type = payload.question_type
    question.question_difficulties = payload.question_difficulties
    question.subject_id = payload.subject_id.strip() if payload.subject_id else None


def _next_version(db: Session, question_id: int) -> int:
    return (db.query(func.max(QuestionRevision.version_number)).filter(QuestionRevision.question_id == question_id).scalar() or 0) + 1


def _create_snapshot_revision(
    db: Session,
    question: Question,
    version_number: int,
    revision_status: str,
    edited_by: int | None,
    approved_by: int | None,
    approved_at: datetime | None,
    rejection_reason: str | None,
) -> QuestionRevision:
    return QuestionRevision(
        question_id=question.question_id,
        version_number=version_number,
        question_status=revision_status,
        edited_by=edited_by,
        approved_by=approved_by,
        approved_at=approved_at,
        rejection_reason=rejection_reason,
        **_snapshot_from_question(question),
    )


@router.get("/questions/pending")
def list_pending_questions(
    search: str | None = None,
    subject_id: str | None = None,
    teacher_id: int | None = None,
    question_type: QuestionTypeLiteral | None = None,
    difficulty: QuestionDifficultyLiteral | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    query = _question_query(db).filter(Question.question_status == QuestionStatus.pending)
    if subject_id:
        query = query.filter(Question.subject_id == subject_id)
    if teacher_id is not None:
        query = query.filter(Question.created_by == teacher_id)
    if question_type:
        query = query.filter(Question.question_type == question_type)
    if difficulty:
        query = query.filter(Question.question_difficulties == difficulty)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.outerjoin(Subject, Question.subject_id == Subject.subject_id).filter(
            or_(Question.question_text.ilike(pattern), Subject.subject_name.ilike(pattern))
        )
    total = query.with_entities(func.count(func.distinct(Question.question_id))).scalar() or 0
    questions = query.order_by(Question.question_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_serialize_question(question) for question in questions], "total": total, "page": page, "page_size": page_size}


@router.get("/questions/{question_id}")
def get_pending_question_detail(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    question = _question_query(db).filter(Question.question_id == question_id).first()
    if not question or _question_status(question) != "pending":
        raise HTTPException(status_code=404, detail="Pending question not found")
    return _serialize_question(question)


@router.post("/questions/{question_id}/approve")
def approve_pending_question(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _admin(db, current_user["school_id"])
        question = _locked_question(db, question_id)
        if _question_status(question) != "pending":
            raise HTTPException(status_code=409, detail="Question is no longer pending")
        payload = _payload_from_question(question)
        _validate_snapshot(db, payload)
        if not db.query(QuestionRevision.revision_id).filter(
            QuestionRevision.question_id == question.question_id,
            QuestionRevision.question_status == "approved",
        ).first():
            db.add(_create_snapshot_revision(
                db, question, _next_version(db, question.question_id), "approved", question.created_by,
                admin.id, datetime.now(), None,
            ))
        db.query(QuestionRevision).filter(
            QuestionRevision.question_id == question.question_id,
            QuestionRevision.question_status == "rejected",
        ).update({"rejection_reason": None}, synchronize_session=False)
        question.question_status = QuestionStatus.approved
        db.commit()
        db.expire_all()
        return _serialize_question(_question_query(db).filter(Question.question_id == question_id).one())
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question approval conflicted with another review") from exc


@router.post("/questions/{question_id}/reject")
def reject_pending_question(
    question_id: int,
    payload: RejectPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _admin(db, current_user["school_id"])
        reason = _validated_reason(payload)
        question = _locked_question(db, question_id)
        if _question_status(question) != "pending":
            raise HTTPException(status_code=409, detail="Question is no longer pending")
        # The current schema has no review columns on question. A rejected audit
        # revision preserves the reason and reviewer without a schema change.
        db.add(_create_snapshot_revision(
            db, question, _next_version(db, question.question_id), "rejected", question.created_by,
            admin.id, datetime.now(), reason,
        ))
        question.question_status = QuestionStatus.rejected
        db.commit()
        db.expire_all()
        return _serialize_question(_question_query(db).filter(Question.question_id == question_id).one())
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question rejection conflicted with another review") from exc


@router.get("/question-revisions/pending")
def list_pending_revisions(
    search: str | None = None,
    subject_id: str | None = None,
    editor_id: int | None = None,
    question_type: QuestionTypeLiteral | None = None,
    difficulty: QuestionDifficultyLiteral | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    query = _revision_query(db).filter(QuestionRevision.question_status == "pending")
    if subject_id:
        query = query.filter(QuestionRevision.subject_id == subject_id)
    if editor_id is not None:
        query = query.filter(QuestionRevision.edited_by == editor_id)
    if question_type:
        query = query.filter(QuestionRevision.question_type == question_type)
    if difficulty:
        query = query.filter(QuestionRevision.question_difficulties == difficulty)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.outerjoin(User, QuestionRevision.edited_by == User.id).filter(
            or_(QuestionRevision.question_text.ilike(pattern), User.full_name.ilike(pattern), QuestionRevision.subject_id.ilike(pattern))
        )
    total = query.with_entities(func.count(func.distinct(QuestionRevision.revision_id))).scalar() or 0
    revisions = query.order_by(QuestionRevision.updated_at.desc(), QuestionRevision.revision_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {"proposed_revision": _serialize_snapshot(revision, db), "active_question": _serialize_question(revision.question, include_options=False)}
            for revision in revisions
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/question-revisions/{revision_id}")
def get_question_revision_detail(
    revision_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    revision = _revision_query(db).filter(QuestionRevision.revision_id == revision_id).first()
    if not revision:
        raise HTTPException(status_code=404, detail="Question revision not found")
    return {"active_question": _serialize_question(revision.question), "proposed_revision": _serialize_snapshot(revision, db)}


@router.post("/question-revisions/{revision_id}/approve")
def approve_pending_revision(
    revision_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _admin(db, current_user["school_id"])
        # Lock the active row first. Teacher create/update/delete-pending flows
        # use the same order, avoiding a Question <-> Revision deadlock.
        revision = _revision_query(db).filter(QuestionRevision.revision_id == revision_id).first()
        if not revision:
            raise HTTPException(status_code=404, detail="Question revision not found")
        question = _locked_question(db, revision.question_id)
        revision = _locked_revision(db, revision_id)
        if _revision_status(revision) != "pending":
            raise HTTPException(status_code=409, detail="Question revision is no longer pending")
        if revision.question_id != question.question_id or _question_status(question) != "approved":
            raise HTTPException(status_code=409, detail="Active question is no longer approved")
        proposed = _snapshot_payload(revision)
        chapters, los = _validate_snapshot(db, proposed)
        _replace_options(db, question, proposed)
        _apply_snapshot(question, proposed)
        _replace_taxonomy(db, question, chapters, los)
        question.question_status = QuestionStatus.approved
        revision.question_status = "approved"
        revision.approved_by = admin.id
        revision.approved_at = datetime.now()
        revision.rejection_reason = None
        db.commit()
        db.expire_all()
        refreshed_revision = _revision_query(db).filter(QuestionRevision.revision_id == revision_id).one()
        return {"active_question": _serialize_question(refreshed_revision.question), "proposed_revision": _serialize_snapshot(refreshed_revision, db)}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question revision could not be applied because referenced data is in use") from exc


@router.post("/question-revisions/{revision_id}/reject")
def reject_pending_revision(
    revision_id: int,
    payload: RejectPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _admin(db, current_user["school_id"])
        reason = _validated_reason(payload)
        revision = _locked_revision(db, revision_id)
        if _revision_status(revision) != "pending":
            raise HTTPException(status_code=409, detail="Question revision is no longer pending")
        revision.question_status = "rejected"
        revision.approved_by = admin.id
        revision.approved_at = datetime.now()
        revision.rejection_reason = reason
        db.commit()
        db.expire_all()
        return _serialize_snapshot(_revision_query(db).filter(QuestionRevision.revision_id == revision_id).one(), db)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question revision rejection conflicted with another review") from exc


# User management uses dedicated payloads so account-control fields cannot be
# supplied by the browser as part of a normal create or update request.
AdminUserRole = Literal["student", "teacher", "admin"]


class CreateAdminUserPayload(BaseModel):
    school_id: str = Field(min_length=1, max_length=30)
    full_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    role: AdminUserRole
    phone: str | None = Field(default=None, max_length=20)
    date_of_birth: date | None = None


class UpdateAdminUserPayload(BaseModel):
    school_id: str | None = Field(default=None, min_length=1, max_length=30)
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, min_length=3, max_length=100)
    password: str | None = Field(default=None, max_length=128)
    role: AdminUserRole | None = None
    phone: str | None = Field(default=None, max_length=20)
    date_of_birth: date | None = None


class ChangeOwnPasswordPayload(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=1, max_length=128)


def _user_role(user: User) -> str:
    return (_value(user.role) or "").lower()


def _valid_email(value: str) -> str:
    email = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="A valid email address is required")
    return email


def _valid_text(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_name} is required")
    return cleaned


def _valid_password(value: str) -> str:
    if len(value) < 8 or not value.strip():
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    return value


def _valid_phone(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    phone = value.strip()
    if not re.fullmatch(r"[0-9+()\-\s]{7,20}", phone):
        raise HTTPException(status_code=400, detail="Phone number format is invalid")
    return phone


def _serialize_admin_user(user: User) -> dict:
    is_deleted = user.deleted_at is not None
    is_locked = bool(user.is_locked)
    return {
        "id": user.id,
        "school_id": user.school_id,
        "full_name": user.full_name,
        "email": user.email,
        "role": _user_role(user),
        "phone": user.phone,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "is_locked": is_locked,
        "locked_at": user.locked_at.isoformat() if user.locked_at else None,
        "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        "status": "deleted" if is_deleted else ("locked" if is_locked else "active"),
    }


def _locked_user(db: Session, user_id: int, *, include_deleted: bool = False) -> User:
    query = db.query(User).filter(User.id == user_id)
    if not include_deleted:
        query = query.filter(User.deleted_at.is_(None))
    user = query.with_for_update().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _ensure_not_last_active_admin(db: Session, target: User) -> None:
    if _user_role(target) != "admin" or target.is_locked or target.deleted_at is not None:
        return
    # Lock the active-admin set in this transaction, preventing two requests
    # from concurrently disabling different final administrators.
    active_admin_ids = (
        db.query(User.id)
        .filter(User.role == UserRole.admin, User.deleted_at.is_(None), User.is_locked.is_(False))
        .with_for_update()
        .all()
    )
    if len(active_admin_ids) <= 1:
        raise HTTPException(
            status_code=409,
            detail="The last active admin cannot be locked, deleted, or demoted",
        )


def _deactivate_teacher_subjects(db: Session, user_id: int) -> None:
    db.query(TeacherSubject).filter(
        TeacherSubject.teacher_id == user_id,
        TeacherSubject.is_active.is_(True),
    ).update({TeacherSubject.is_active: False}, synchronize_session=False)


def _management_admin(db: Session, current_user: dict) -> User:
    return _admin(db, current_user["school_id"])


@router.get("/users")
def list_users(
    search: Annotated[str | None, Query(max_length=100)] = None,
    role: AdminUserRole | None = None,
    locked: bool | None = None,
    include_deleted: bool = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _management_admin(db, current_user)
    query = db.query(User)
    if not include_deleted:
        query = query.filter(User.deleted_at.is_(None))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(User.school_id.ilike(term), User.full_name.ilike(term), User.email.ilike(term)))
    if role:
        query = query.filter(User.role == UserRole(role))
    if locked is not None:
        query = query.filter(User.is_locked.is_(locked))
    total = query.count()
    users = query.order_by(User.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_serialize_admin_user(user) for user in users], "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: int,
    include_deleted: bool = False,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _management_admin(db, current_user)
    query = db.query(User).filter(User.id == user_id)
    if not include_deleted:
        query = query.filter(User.deleted_at.is_(None))
    user = query.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_admin_user(user)


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateAdminUserPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        _management_admin(db, current_user)
        school_id = _valid_text(payload.school_id, "School ID")
        full_name = _valid_text(payload.full_name, "Full name")
        email = _valid_email(payload.email)
        password = _valid_password(payload.password)
        if db.query(User.id).filter(User.school_id == school_id).first():
            raise HTTPException(status_code=409, detail="School ID already exists")
        if db.query(User.id).filter(User.email == email).first():
            raise HTTPException(status_code=409, detail="Email already exists")
        user = User(
            school_id=school_id,
            full_name=full_name,
            email=email,
            password_hash=generate_password_hash(password),
            role=UserRole(payload.role),
            phone=_valid_phone(payload.phone),
            date_of_birth=payload.date_of_birth,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return _serialize_admin_user(user)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="School ID or email already exists") from exc


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UpdateAdminUserPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _management_admin(db, current_user)
        user = _locked_user(db, user_id)
        is_own_admin_account = user.id == admin.id and _user_role(user) == "admin"

        # Reject all prohibited account mutations before changing any managed fields.
        if payload.password is not None:
            if user.id != admin.id:
                raise HTTPException(status_code=403, detail="You can only change your own password")
            raise HTTPException(status_code=400, detail="Use the dedicated password change endpoint")
        if is_own_admin_account and payload.role is not None and payload.role != "admin":
            raise HTTPException(status_code=409, detail="You cannot change the role of your own admin account")
        if (
            is_own_admin_account
            and payload.school_id is not None
            and payload.school_id.strip() != user.school_id
        ):
            raise HTTPException(status_code=409, detail="You cannot change the school ID of your current account")

        if payload.school_id is not None:
            school_id = _valid_text(payload.school_id, "School ID")
            if db.query(User.id).filter(User.school_id == school_id, User.id != user.id).first():
                raise HTTPException(status_code=409, detail="School ID already exists")
            user.school_id = school_id
        if payload.full_name is not None:
            user.full_name = _valid_text(payload.full_name, "Full name")
        if payload.email is not None:
            email = _valid_email(payload.email)
            if db.query(User.id).filter(User.email == email, User.id != user.id).first():
                raise HTTPException(status_code=409, detail="Email already exists")
            user.email = email
        if "phone" in payload.model_fields_set:
            user.phone = _valid_phone(payload.phone)
        if "date_of_birth" in payload.model_fields_set:
            user.date_of_birth = payload.date_of_birth
        if payload.role is not None:
            new_role = UserRole(payload.role)
            if _user_role(user) == "teacher" and new_role != UserRole.teacher:
                _deactivate_teacher_subjects(db, user.id)
            if _user_role(user) == "admin" and new_role != UserRole.admin:
                _ensure_not_last_active_admin(db, user)
            user.role = new_role
        db.commit()
        db.refresh(user)
        return _serialize_admin_user(user)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="School ID or email already exists") from exc


@router.put("/me/password")
def change_own_password(
    payload: ChangeOwnPasswordPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _management_admin(db, current_user)
        if not check_password_hash(admin.password_hash, payload.current_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        if payload.new_password != payload.confirm_password:
            raise HTTPException(status_code=400, detail="Password confirmation does not match")
        new_password = _valid_password(payload.new_password)
        if check_password_hash(admin.password_hash, new_password):
            raise HTTPException(status_code=400, detail="New password must be different from the current password")
        admin.password_hash = generate_password_hash(new_password)
        db.commit()
        return {"success": True, "message": "Password changed successfully"}
    except HTTPException:
        db.rollback()
        raise


@router.post("/users/{user_id}/lock")
def lock_user(
    user_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _management_admin(db, current_user)
        user = _locked_user(db, user_id)
        if user.id == admin.id:
            raise HTTPException(status_code=409, detail="You cannot lock your own account")
        if user.is_locked:
            raise HTTPException(status_code=409, detail="User is already locked")
        _ensure_not_last_active_admin(db, user)
        user.is_locked = True
        user.locked_at = datetime.now()
        user.locked_by = admin.id
        db.commit()
        db.refresh(user)
        return _serialize_admin_user(user)
    except HTTPException:
        db.rollback()
        raise


@router.post("/users/{user_id}/unlock")
def unlock_user(
    user_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        _management_admin(db, current_user)
        user = _locked_user(db, user_id)
        if not user.is_locked:
            raise HTTPException(status_code=409, detail="User is not locked")
        user.is_locked = False
        user.locked_at = None
        user.locked_by = None
        db.commit()
        db.refresh(user)
        return _serialize_admin_user(user)
    except HTTPException:
        db.rollback()
        raise


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _management_admin(db, current_user)
        user = _locked_user(db, user_id, include_deleted=True)
        if user.deleted_at is not None:
            raise HTTPException(status_code=409, detail="User has already been deleted")
        if user.id == admin.id:
            raise HTTPException(status_code=409, detail="You cannot delete your own account")
        _ensure_not_last_active_admin(db, user)
        if _user_role(user) == "teacher":
            _deactivate_teacher_subjects(db, user.id)
        user.deleted_at = datetime.now()
        user.deleted_by = admin.id
        user.is_locked = True
        user.locked_at = datetime.now()
        user.locked_by = admin.id
        db.commit()
        return None
    except HTTPException:
        db.rollback()
        raise


class TeacherPermissionPayload(BaseModel):
    teacher_id: int
    subject_id: str = Field(min_length=1, max_length=20)


class UpdateTeacherPermissionPayload(BaseModel):
    is_active: bool | None = None
    new_subject_id: str | None = Field(default=None, min_length=1, max_length=20)


class ReplaceTeacherPermissionsPayload(BaseModel):
    subject_ids: list[str] = Field(default_factory=list, max_length=100)


def _permission_teacher(db: Session, teacher_id: int) -> User:
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if _user_role(teacher) != "teacher":
        raise HTTPException(status_code=400, detail="User is not a teacher")
    if teacher.is_locked or teacher.deleted_at is not None:
        raise HTTPException(status_code=409, detail="Teacher account is unavailable")
    return teacher


def _permission_subject(db: Session, subject_id: str) -> Subject:
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


def _serialize_teacher_permission(item: TeacherSubject) -> dict:
    return {
        "teacher_id": item.teacher_id,
        "teacher_school_id": item.teacher.school_id,
        "teacher_full_name": item.teacher.full_name,
        "teacher_email": item.teacher.email,
        "subject_id": item.subject_id,
        "subject_name": item.subject.subject_name,
        "assigned_by": item.assigned_by,
        "assigned_by_school_id": item.assigner.school_id if item.assigner else None,
        "assigned_by_full_name": item.assigner.full_name if item.assigner else None,
        "assigned_at": item.assigned_at.isoformat() if item.assigned_at else None,
        "is_active": bool(item.is_active),
    }


def _serialize_teacher_permission_set(teacher: User, items: list[TeacherSubject]) -> dict:
    return {
        "teacher_id": teacher.id,
        "teacher_school_id": teacher.school_id,
        "teacher_full_name": teacher.full_name,
        "teacher_email": teacher.email,
        "permissions": [
            {
                "subject_id": item.subject_id,
                "subject_name": item.subject.subject_name,
                "assigned_by": item.assigned_by,
                "assigned_at": item.assigned_at.isoformat() if item.assigned_at else None,
                "is_active": bool(item.is_active),
            }
            for item in items
            if item.is_active
        ],
    }


@router.get("/teacher-permissions")
def list_teacher_permissions(
    search: str | None = None, teacher_id: int | None = None, subject_id: str | None = None, is_active: bool | None = None,
    current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db),
):
    del role_check
    _management_admin(db, current_user)
    query = db.query(TeacherSubject).join(TeacherSubject.teacher).join(TeacherSubject.subject)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(User.full_name.ilike(term), User.school_id.ilike(term), User.email.ilike(term)))
    if teacher_id is not None: query = query.filter(TeacherSubject.teacher_id == teacher_id)
    if subject_id: query = query.filter(TeacherSubject.subject_id == subject_id)
    if is_active is not None: query = query.filter(TeacherSubject.is_active.is_(is_active))
    return {"items": [_serialize_teacher_permission(item) for item in query.order_by(TeacherSubject.teacher_id, TeacherSubject.subject_id).all()]}


@router.get("/teacher-permissions/teachers")
def list_permission_teachers(current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _management_admin(db, current_user)
    return [{"id": user.id, "school_id": user.school_id, "full_name": user.full_name, "email": user.email} for user in db.query(User).filter(User.role == UserRole.teacher, User.deleted_at.is_(None), User.is_locked.is_(False)).order_by(User.full_name, User.id).all()]


@router.get("/teacher-permissions/subjects")
def list_permission_subjects(current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _management_admin(db, current_user)
    return [{"subject_id": subject.subject_id, "subject_name": subject.subject_name} for subject in db.query(Subject).order_by(Subject.subject_name).all()]


@router.get("/teachers/{teacher_id}/permissions")
def list_teacher_subject_permissions(teacher_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _management_admin(db, current_user)
    _permission_teacher(db, teacher_id)
    return {"items": [_serialize_teacher_permission(item) for item in db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher_id).order_by(TeacherSubject.subject_id).all()]}


@router.patch("/teachers/{teacher_id}/permissions")
def replace_teacher_permissions(
    teacher_id: int,
    payload: ReplaceTeacherPermissionsPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Atomically replace a teacher's complete active subject-access set."""
    del role_check
    try:
        admin = _management_admin(db, current_user)
        teacher = _permission_teacher(db, teacher_id)
        subject_ids = [subject_id.strip() for subject_id in payload.subject_ids]
        if any(not subject_id for subject_id in subject_ids) or len(subject_ids) != len(set(subject_ids)):
            raise HTTPException(status_code=400, detail="Subject IDs must be unique and non-empty")
        subjects = db.query(Subject).filter(Subject.subject_id.in_(subject_ids)).all() if subject_ids else []
        if len(subjects) != len(subject_ids):
            raise HTTPException(status_code=404, detail="One or more subjects were not found")

        existing = {
            item.subject_id: item
            for item in db.query(TeacherSubject)
            .filter(TeacherSubject.teacher_id == teacher.id)
            .with_for_update()
            .all()
        }
        requested = set(subject_ids)
        now = datetime.now()
        for subject_id, item in existing.items():
            if subject_id not in requested and item.is_active:
                item.is_active = False
        for subject_id in requested:
            item = existing.get(subject_id)
            if item is None:
                item = TeacherSubject(teacher_id=teacher.id, subject_id=subject_id, is_active=True, assigned_by=admin.id, assigned_at=now)
                db.add(item)
            elif not item.is_active:
                item.is_active = True
                item.assigned_by = admin.id
                item.assigned_at = now
        db.commit()
        refreshed = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher.id).order_by(TeacherSubject.subject_id).all()
        return _serialize_teacher_permission_set(teacher, refreshed)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Teacher permissions could not be updated") from exc


@router.post("/teacher-permissions", status_code=status.HTTP_201_CREATED)
def grant_teacher_permission(payload: TeacherPermissionPayload, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    try:
        admin = _management_admin(db, current_user); _permission_teacher(db, payload.teacher_id); _permission_subject(db, payload.subject_id)
        item = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == payload.teacher_id, TeacherSubject.subject_id == payload.subject_id).with_for_update().first()
        if item and item.is_active: raise HTTPException(status_code=409, detail="Teacher already has active permission for this subject")
        if not item:
            item = TeacherSubject(teacher_id=payload.teacher_id, subject_id=payload.subject_id); db.add(item)
        item.is_active = True; item.assigned_by = admin.id; item.assigned_at = datetime.now()
        db.commit(); db.refresh(item); return _serialize_teacher_permission(item)
    except HTTPException:
        db.rollback(); raise
    except IntegrityError as exc:
        db.rollback(); raise HTTPException(status_code=409, detail="Teacher permission conflicts with an existing assignment") from exc


@router.patch("/teacher-permissions/{teacher_id}/{subject_id}")
def update_teacher_permission(teacher_id: int, subject_id: str, payload: UpdateTeacherPermissionPayload, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    try:
        admin = _management_admin(db, current_user); _permission_teacher(db, teacher_id)
        item = db.query(TeacherSubject).filter_by(teacher_id=teacher_id, subject_id=subject_id).with_for_update().first()
        if not item: raise HTTPException(status_code=404, detail="Teacher permission not found")
        if payload.new_subject_id and payload.new_subject_id != subject_id:
            _permission_subject(db, payload.new_subject_id)
            other = db.query(TeacherSubject).filter_by(teacher_id=teacher_id, subject_id=payload.new_subject_id).with_for_update().first()
            if other and other.is_active: raise HTTPException(status_code=409, detail="Teacher already has active permission for this subject")
            item.is_active = False
            if other: item = other
            else: item = TeacherSubject(teacher_id=teacher_id, subject_id=payload.new_subject_id); db.add(item)
            item.is_active = True
        if payload.is_active is not None: item.is_active = payload.is_active
        item.assigned_by = admin.id; item.assigned_at = datetime.now()
        db.commit(); db.refresh(item); return _serialize_teacher_permission(item)
    except HTTPException:
        db.rollback(); raise


@router.delete("/teacher-permissions/{teacher_id}/{subject_id}")
def revoke_teacher_permission(teacher_id: int, subject_id: str, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    try:
        _management_admin(db, current_user)
        item = db.query(TeacherSubject).filter_by(teacher_id=teacher_id, subject_id=subject_id).with_for_update().first()
        if not item: raise HTTPException(status_code=404, detail="Teacher permission not found")
        item.is_active = False; db.commit(); db.refresh(item); return _serialize_teacher_permission(item)
    except HTTPException:
        db.rollback(); raise
