import csv
from datetime import date, datetime, time, timedelta
from io import StringIO
from uuid import uuid4
from dataclasses import dataclass
from pathlib import Path
import re
import tempfile
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased, selectinload
from starlette.concurrency import run_in_threadpool

from database import get_db
from src.a_db_config import (
    Attempt,
    AttemptQuestion,
    Chapter,
    ChapterLO,
    ChapterQuestion,
    CourseClass,
    ExamPoolQuestion,
    ExamQuestion,
    Exam,
    LO,
    LOQuestion,
    MCQAnswer,
    Option,
    Question,
    QuestionRevision,
    QuestionStatus,
    StudentClass,
    Subject,
    TeacherSubject,
    User,
    UserRole,
    BackgroundJob,
    BackgroundJobStatus,
    BackgroundJobType,
    BulkDataRequest,
    BulkDataRequestStatus,
    BulkDataRequestType,
    AuditLog,
)
from src.middleware.authMiddleware import ADMIN_ONLY, verify_token, TEACHER_ONLY
from src.service.audit_service import record_audit
from src.service.audit_catalog import audit_action_info, hidden_audit_actions, visible_audit_actions
from src.service.event_contract import sanitize_metadata
from src.service.cache_invalidation_contract import admin_enrollment_updated, admin_permission_updated, deliver_invalidation
from src.service.cache_service import admin_teacher_permissions_key, cache_aside
from src.service.health_service import system_health
from src.service.outbox_publisher import enqueue_outbox_event
from src.service.report_job_service import REPORT_TYPE_EXAM_RESULTS, report_artifact_bytes, report_job_summary, request_exam_results_report
from src.service.import_job_service import (
    delete_staged_source,
    import_job_summary,
    queue_import_job,
    should_background_import,
)
from src.service.question_bank_import_parser import (
    ParsedQuestionBank,
    QuestionBankParseError,
    parse_question_bank_document,
)
from src.service.user_import_service import ParsedUserImportRow, UserImportParseError, parse_user_import_xlsx
from src.service import bulk_data_request_storage as bulk_request_storage
from src.service.teacher_subject_service import require_active_subject_assignment
from werkzeug.security import check_password_hash, generate_password_hash


router = APIRouter()


@router.get("/system-health")
def get_system_health(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Expose an Admin-only, secret-free summary of real application health."""
    _admin(db, current_user["school_id"])
    return system_health(db)

QuestionTypeLiteral = Literal["MCQ", "essay", "true-false"]
QuestionDifficultyLiteral = Literal["easy", "medium", "hard"]


class RejectPayload(BaseModel):
    reason: str = Field(max_length=500)


class CreateReportJobPayload(BaseModel):
    request_id: str = Field(alias="requestId", min_length=1, max_length=64)


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


def _normalized_import_name(value: str) -> str:
    return " ".join(value.split()).casefold()


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
        "creator": _user_summary(question.creator),
        "chapters": _question_chapters(question),
        "learning_objectives": _question_los(question),
        "created_at": getattr(question, "created_at", None).isoformat() if getattr(question, "created_at", None) else None,
        "updated_at": getattr(question, "updated_at", None).isoformat() if getattr(question, "updated_at", None) else None,
        "usage_count": len(question.exam_questions),
        "option_count": len([option for option in question.options if option.options_text.strip()]),
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
        selectinload(Question.exam_questions),
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


def _apply_question_filters(query, subject_id, chapter_id, lo_id, search, question_type, difficulty):
    query = query.outerjoin(Subject, Question.subject_id == Subject.subject_id)
    if subject_id:
        query = query.filter(Question.subject_id == subject_id)
    if chapter_id is not None:
        query = query.join(ChapterQuestion, Question.question_id == ChapterQuestion.question_id).filter(
            ChapterQuestion.chapter_id == chapter_id
        )
    if lo_id is not None:
        query = query.join(LOQuestion, Question.question_id == LOQuestion.question_id).filter(
            LOQuestion.lo_id == lo_id
        )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(Question.question_text.ilike(pattern), Subject.subject_name.ilike(pattern)))
    if question_type:
        query = query.filter(Question.question_type == question_type)
    if difficulty:
        query = query.filter(Question.question_difficulties == difficulty)
    return query


def _ensure_question_can_be_deleted(db: Session, question: Question) -> None:
    question_id = question.question_id
    if db.query(ExamQuestion.question_id).filter(ExamQuestion.question_id == question_id).first():
        raise HTTPException(status_code=409, detail="Question is used by an exam and cannot be deleted")
    if db.query(AttemptQuestion.question_id).filter(AttemptQuestion.question_id == question_id).first():
        raise HTTPException(status_code=409, detail="Question is referenced by an attempt and cannot be deleted")
    if db.query(ExamPoolQuestion.question_id).filter(ExamPoolQuestion.question_id == question_id).first():
        raise HTTPException(status_code=409, detail="Question is used by an exam pool and cannot be deleted")
    if db.query(QuestionRevision.revision_id).filter(QuestionRevision.question_id == question_id).first():
        raise HTTPException(status_code=409, detail="Question has revision history and cannot be deleted")
    if db.query(Question.question_id).filter(Question.source_question_id == question_id).first():
        raise HTTPException(status_code=409, detail="Question has derived copies and cannot be deleted")


def _next_version(db: Session, question_id: int) -> int:
    return (db.query(func.max(QuestionRevision.version_number)).filter(QuestionRevision.question_id == question_id).scalar() or 0) + 1


def _create_snapshot_revision(
    db: Session,
    question: Question,
    version_number: int,
    revision_status: str,
    edited_by: str | None,
    approved_by: str | None,
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


def build_question_bank_import_preview(
    parsed: ParsedQuestionBank,
    subject_id: str,
    current_user: dict,
    db: Session,
) -> dict:
    """Resolve an import document against the taxonomy without changing it."""

    admin = _admin(db, current_user["school_id"])
    selected_subject_id = subject_id.strip()
    subject = db.query(Subject).filter(Subject.subject_id == selected_subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Selected subject was not found")
    if parsed.subject.subject_id != selected_subject_id:
        raise HTTPException(
            status_code=400,
            detail=(
                f"The uploaded file belongs to subject {parsed.subject.subject_id}, "
                f"but the selected subject is {selected_subject_id}."
            ),
        )

    subject_warnings: list[str] = []
    if _normalized_import_name(parsed.subject.subject_name) != _normalized_import_name(subject.subject_name):
        subject_warnings.append(
            f"Uploaded Subject Name '{parsed.subject.subject_name}' differs from database Subject Name '{subject.subject_name}'."
        )

    existing_chapters = db.query(Chapter).filter(Chapter.subject_id == selected_subject_id).all()
    chapters_by_name: dict[str, list[Chapter]] = {}
    for chapter in existing_chapters:
        chapters_by_name.setdefault(_normalized_import_name(chapter.chapter_name), []).append(chapter)

    chapter_entries: list[dict] = []
    chapter_resolutions: dict[str, tuple[str, Chapter | None, str]] = {}
    for question in parsed.questions:
        key = _normalized_import_name(question.chapter_name)
        if key in chapter_resolutions:
            continue
        matches = chapters_by_name.get(key, [])
        if len(matches) == 1:
            action, chapter = "reuse", matches[0]
        elif not matches:
            action, chapter = "create", None
        else:
            action, chapter = "conflict", None
        chapter_resolutions[key] = (action, chapter, question.chapter_name)
        entry = {"chapter_name": question.chapter_name, "action": action}
        if chapter is not None:
            entry["chapter_id"] = chapter.chapter_id
        chapter_entries.append(entry)

    lo_entries: list[dict] = []
    lo_resolutions: dict[tuple[str, str], tuple[str, LO | None, str, str]] = {}
    for question in parsed.questions:
        chapter_key = _normalized_import_name(question.chapter_name)
        chapter_action, chapter, chapter_name = chapter_resolutions[chapter_key]
        for lo_name in question.learning_objective_names:
            lo_key = (chapter_key, _normalized_import_name(lo_name))
            if lo_key in lo_resolutions:
                continue
            if chapter_action == "conflict":
                action, lo = "conflict", None
            elif chapter is None:
                # The parent Chapter will be created by the later import step,
                # so its not-yet-persisted LOs are also unambiguous creates.
                action, lo = "create", None
            else:
                matches = (
                    db.query(LO)
                    .join(ChapterLO, ChapterLO.lo_id == LO.lo_id)
                    .filter(ChapterLO.chapter_id == chapter.chapter_id)
                    .all()
                )
                named_matches = [item for item in matches if _normalized_import_name(item.lo_name) == lo_key[1]]
                if len(named_matches) == 1:
                    action, lo = "reuse", named_matches[0]
                elif not named_matches:
                    action, lo = "create", None
                else:
                    action, lo = "conflict", None
            lo_resolutions[lo_key] = (action, lo, chapter_name, lo_name)
            entry = {"chapter_name": chapter_name, "lo_name": lo_name, "action": action}
            if lo is not None:
                entry["lo_id"] = lo.lo_id
            lo_entries.append(entry)

    existing_questions = db.query(Question).filter(Question.subject_id == selected_subject_id).all()
    existing_exact = {
        (_normalized_import_name(question.question_text), _value(question.question_type))
        for question in existing_questions
    }
    question_entries: list[dict] = []
    for question in parsed.questions:
        errors: list[str] = []
        warnings: list[str] = []
        chapter_key = _normalized_import_name(question.chapter_name)
        chapter_action, _, _ = chapter_resolutions[chapter_key]
        if chapter_action == "conflict":
            errors.append(f"Chapter '{question.chapter_name}' is ambiguous in the selected subject.")
        for lo_name in question.learning_objective_names:
            lo_action, _, _, _ = lo_resolutions[(chapter_key, _normalized_import_name(lo_name))]
            if lo_action == "conflict":
                errors.append(f"Learning Objective '{lo_name}' is ambiguous for chapter '{question.chapter_name}'.")

        is_duplicate = (_normalized_import_name(question.question_text), question.question_type) in existing_exact
        if errors:
            question_status = "error"
        elif is_duplicate:
            question_status = "duplicate"
            warnings.append("This question already exists and will be skipped.")
        else:
            question_status = "valid"
        question_entries.append(
            {
                "question_number": question.question_number,
                "question_text": question.question_text,
                "question_type": question.question_type,
                "difficulty": question.difficulty,
                "chapter_name": question.chapter_name,
                "learning_objectives": question.learning_objective_names,
                "status": question_status,
                "errors": errors,
                "warnings": warnings,
            }
        )

    return {
        "subject": {
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "status": "valid",
            "warnings": subject_warnings,
        },
        "chapters": chapter_entries,
        "learning_objectives": lo_entries,
        "questions": question_entries,
        "summary": {
            "total_questions": len(question_entries),
            "valid_questions": sum(item["status"] == "valid" for item in question_entries),
            "duplicate_questions": sum(item["status"] == "duplicate" for item in question_entries),
            "error_questions": sum(item["status"] == "error" for item in question_entries),
            "chapters_to_create": sum(item["action"] == "create" for item in chapter_entries),
            "learning_objectives_to_create": sum(item["action"] == "create" for item in lo_entries),
        },
    }


def _parse_question_bank_content(filename: str | None, content: bytes) -> ParsedQuestionBank:
    """Parse a staged document away from the async request event loop."""

    suffix = Path(filename or "").suffix.casefold()
    if suffix not in {".docx", ".pdf"}:
        raise HTTPException(status_code=400, detail="Only .docx and text-based .pdf files are supported")

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary_file:
            temp_path = Path(temporary_file.name)
            temporary_file.write(content)
        return parse_question_bank_document(temp_path)
    except QuestionBankParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


async def _parse_question_bank_upload(file: UploadFile) -> ParsedQuestionBank:
    """Read the async upload, then offload file parsing and temporary-file I/O."""

    content = await file.read()
    return await run_in_threadpool(_parse_question_bank_content, file.filename, content)


@router.post("/question-bank/import/preview")
async def preview_question_bank_import(
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Parse and preview an import file. This route never writes DB rows."""

    del role_check
    parsed = await _parse_question_bank_upload(file)
    return await run_in_threadpool(build_question_bank_import_preview, parsed, subject_id, current_user, db)


def build_new_subject_import_preview(parsed: ParsedQuestionBank, current_user: dict, db: Session) -> dict:
    """Preview a file that will create its Subject; this endpoint never writes."""

    _admin(db, current_user["school_id"])
    if db.query(Subject.subject_id).filter(Subject.subject_id == parsed.subject.subject_id).first():
        raise HTTPException(
            status_code=409,
            detail=(
                f"Subject {parsed.subject.subject_id} already exists. "
                "Select it and use Import Questions instead."
            ),
        )

    chapters: list[dict] = []
    learning_objectives: list[dict] = []
    seen_chapters: set[str] = set()
    seen_los: set[tuple[str, str]] = set()
    questions: list[dict] = []
    for question in parsed.questions:
        chapter_key = _normalized_import_name(question.chapter_name)
        if chapter_key not in seen_chapters:
            seen_chapters.add(chapter_key)
            chapters.append({"chapter_name": question.chapter_name, "action": "create"})
        for lo_name in question.learning_objective_names:
            lo_key = (chapter_key, _normalized_import_name(lo_name))
            if lo_key not in seen_los:
                seen_los.add(lo_key)
                learning_objectives.append(
                    {"chapter_name": question.chapter_name, "lo_name": lo_name, "action": "create"}
                )
        questions.append(
            {
                "question_number": question.question_number,
                "question_text": question.question_text,
                "question_type": question.question_type,
                "difficulty": question.difficulty,
                "chapter_name": question.chapter_name,
                "learning_objectives": question.learning_objective_names,
                "status": "valid",
                "errors": [],
                "warnings": [],
            }
        )

    return {
        "subject": {
            "subject_id": parsed.subject.subject_id,
            "subject_name": parsed.subject.subject_name,
            "subject_description": parsed.subject.description,
            "status": "new",
            "warnings": ["A new Subject, Chapters, Learning Objectives, and approved Questions will be created."],
        },
        "chapters": chapters,
        "learning_objectives": learning_objectives,
        "questions": questions,
        "summary": {
            "total_questions": len(questions),
            "valid_questions": len(questions),
            "duplicate_questions": 0,
            "error_questions": 0,
            "chapters_to_create": len(chapters),
            "learning_objectives_to_create": len(learning_objectives),
        },
    }


@router.post("/question-bank/import/new-subject/preview")
async def preview_new_subject_question_bank_import(
    file: UploadFile = File(...),
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Preview a document whose Subject does not yet exist in the database."""

    del role_check
    parsed = await _parse_question_bank_upload(file)
    return await run_in_threadpool(build_new_subject_import_preview, parsed, current_user, db)


def _persist_imported_question_bank(
    parsed: ParsedQuestionBank,
    subject_id: str,
    current_user: dict,
    db: Session,
    creator_school_id: str | None = None,
) -> dict:
    """Create/reuse a Subject's taxonomy and Questions without committing."""

    chapters_created = 0
    learning_objectives_created = 0
    imported_question_ids: list[int] = []
    duplicate_skipped_count = 0
    chapter_cache: dict[str, Chapter] = {}
    lo_cache: dict[tuple[int, str], LO] = {}
    existing_exact = {
        (_normalized_import_name(question.question_text), _value(question.question_type))
        for question in db.query(Question).filter(Question.subject_id == subject_id).all()
    }

    for imported_question in parsed.questions:
        chapter_key = _normalized_import_name(imported_question.chapter_name)
        chapter = chapter_cache.get(chapter_key)
        if chapter is None:
            chapter_matches = [
                item
                for item in db.query(Chapter).filter(Chapter.subject_id == subject_id).all()
                if _normalized_import_name(item.chapter_name) == chapter_key
            ]
            if len(chapter_matches) > 1:
                raise HTTPException(
                    status_code=409,
                    detail=f"Chapter '{imported_question.chapter_name}' is ambiguous in the selected subject",
                )
            if chapter_matches:
                chapter = chapter_matches[0]
            else:
                chapter = Chapter(
                    chapter_name=imported_question.chapter_name,
                    chapter_description=imported_question.chapter_name,
                    subject_id=subject_id,
                )
                db.add(chapter)
                db.flush()
                chapters_created += 1
            chapter_cache[chapter_key] = chapter

        resolved_los: list[LO] = []
        for imported_lo_name in imported_question.learning_objective_names:
            lo_key = (chapter.chapter_id, _normalized_import_name(imported_lo_name))
            lo = lo_cache.get(lo_key)
            if lo is None:
                lo_matches = [
                    item
                    for item in (
                        db.query(LO)
                        .join(ChapterLO, ChapterLO.lo_id == LO.lo_id)
                        .filter(ChapterLO.chapter_id == chapter.chapter_id)
                        .all()
                    )
                    if _normalized_import_name(item.lo_name) == lo_key[1]
                ]
                if len(lo_matches) > 1:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Learning Objective '{imported_lo_name}' is ambiguous "
                            f"for chapter '{imported_question.chapter_name}'"
                        ),
                    )
                if lo_matches:
                    lo = lo_matches[0]
                else:
                    lo = LO(lo_name=imported_lo_name, lo_description=imported_lo_name)
                    db.add(lo)
                    db.flush()
                    db.add(ChapterLO(chapter_id=chapter.chapter_id, lo_id=lo.lo_id))
                    learning_objectives_created += 1
                lo_cache[lo_key] = lo
            resolved_los.append(lo)

        duplicate_key = (_normalized_import_name(imported_question.question_text), imported_question.question_type)
        if duplicate_key in existing_exact:
            duplicate_skipped_count += 1
            continue

        question = Question(
            question_text=imported_question.question_text,
            question_type=imported_question.question_type,
            question_difficulties=imported_question.difficulty,
            subject_id=subject_id,
            created_by=creator_school_id or current_user["school_id"],
            question_status=QuestionStatus.approved,
        )
        db.add(question)
        db.flush()
        db.add(ChapterQuestion(question_id=question.question_id, chapter_id=chapter.chapter_id))
        db.add_all(LOQuestion(question_id=question.question_id, lo_id=lo.lo_id) for lo in resolved_los)
        db.add_all(
            Option(
                question_id=question.question_id,
                options_text=imported_option.option_text,
                is_correct=imported_option.is_correct,
            )
            for imported_option in imported_question.options
        )
        existing_exact.add(duplicate_key)
        imported_question_ids.append(question.question_id)

    return {
        "imported_count": len(imported_question_ids),
        "duplicate_skipped_count": duplicate_skipped_count,
        "chapters_created": chapters_created,
        "learning_objectives_created": learning_objectives_created,
        "question_ids": imported_question_ids,
    }


def import_question_bank_data(
    parsed: ParsedQuestionBank,
    subject_id: str,
    current_user: dict,
    db: Session,
    *,
    creator_school_id: str | None = None,
    commit: bool = True,
) -> dict:
    """Persist one validated import in a single all-or-nothing transaction."""

    admin = _admin(db, current_user["school_id"])
    selected_subject_id = subject_id.strip()

    try:
        # Serializing imports for the selected Subject prevents two administrators
        # from independently creating the same normalized taxonomy at once.
        subject = (
            db.query(Subject)
            .filter(Subject.subject_id == selected_subject_id)
            .with_for_update()
            .first()
        )
        if not subject:
            raise HTTPException(status_code=404, detail="Selected subject was not found")
        if parsed.subject.subject_id != selected_subject_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"The uploaded file belongs to subject {parsed.subject.subject_id}, "
                    f"but the selected subject is {selected_subject_id}."
                ),
            )
        result = _persist_imported_question_bank(
            parsed, selected_subject_id, current_user, db, creator_school_id=creator_school_id
        )
        if commit:
            record_audit(
                db, actor_school_id=admin.school_id, actor_role=admin.role,
                action="QUESTION_IMPORT_COMPLETED", entity_type="subject", entity_id=selected_subject_id,
                metadata={
                    "subject_id": selected_subject_id,
                    "imported_count": result["imported_count"],
                    "duplicate_skipped_count": result["duplicate_skipped_count"],
                    "created_chapter_count": result["chapters_created"],
                    "created_lo_count": result["learning_objectives_created"],
                    "new_subject": False,
                },
            )
            db.commit()
    except HTTPException:
        if commit:
            db.rollback()
        raise
    except IntegrityError as exc:
        if commit:
            db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Import could not be completed because question bank data changed concurrently. No data was imported.",
        ) from exc
    except Exception as exc:
        if commit:
            db.rollback()
        raise HTTPException(status_code=500, detail="Import failed. No data was imported.") from exc

    return {"subject_id": selected_subject_id, **result}


def import_new_subject_question_bank_data(
    parsed: ParsedQuestionBank,
    confirmed: bool,
    current_user: dict,
    db: Session,
    *,
    commit: bool = True,
) -> dict:
    """Create a new Subject and its Question Bank in one transaction."""

    admin = _admin(db, current_user["school_id"])
    if not confirmed:
        raise HTTPException(status_code=400, detail="Creating a new Subject requires explicit confirmation")

    try:
        if db.query(Subject.subject_id).filter(Subject.subject_id == parsed.subject.subject_id).first():
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Subject {parsed.subject.subject_id} already exists. "
                    "Select it and use Import Questions instead."
                ),
            )
        subject = Subject(
            subject_id=parsed.subject.subject_id,
            subject_name=parsed.subject.subject_name,
            subject_description=parsed.subject.description,
        )
        db.add(subject)
        db.flush()
        result = _persist_imported_question_bank(parsed, subject.subject_id, current_user, db)
        if commit:
            record_audit(
                db, actor_school_id=admin.school_id, actor_role=admin.role,
                action="QUESTION_IMPORT_COMPLETED", entity_type="subject", entity_id=subject.subject_id,
                metadata={
                    "subject_id": subject.subject_id,
                    "imported_count": result["imported_count"],
                    "duplicate_skipped_count": result["duplicate_skipped_count"],
                    "created_chapter_count": result["chapters_created"],
                    "created_lo_count": result["learning_objectives_created"],
                    "new_subject": True,
                },
            )
            db.commit()
    except HTTPException:
        if commit:
            db.rollback()
        raise
    except IntegrityError as exc:
        if commit:
            db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                f"Subject {parsed.subject.subject_id} was created by another request. "
                "Select it and use Import Questions instead."
            ),
        ) from exc
    except Exception as exc:
        if commit:
            db.rollback()
        raise HTTPException(status_code=500, detail="New Subject import failed. No data was imported.") from exc

    return {
        "subject": {
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "subject_description": subject.subject_description,
        },
        **result,
    }


@router.post("/question-bank/import", status_code=status.HTTP_201_CREATED)
async def import_question_bank(
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Parse, validate, resolve, and import a document in one transaction."""

    del role_check
    content = await file.read()
    parsed = await run_in_threadpool(_parse_question_bank_content, file.filename, content)
    if should_background_import(len(parsed.questions)):
        admin = await run_in_threadpool(_admin, db, current_user["school_id"])
        job = None
        try:
            job, duplicate = await run_in_threadpool(
                queue_import_job,
                db,
                job_type=BackgroundJobType.question_import,
                requested_by=admin.school_id,
                filename=file.filename,
                content=content,
                total_rows=len(parsed.questions),
                scope=f"subject:{subject_id.strip()}",
                metadata={"subject_id": subject_id.strip(), "new_subject": False},
            )
            if not duplicate:
                record_audit(
                    db, actor_school_id=admin.school_id, actor_role=admin.role,
                    action="QUESTION_IMPORT_QUEUED", entity_type="background_job", entity_id=job.job_id,
                    metadata={"subject_id": subject_id.strip(), "job_id": job.job_id, "row_count": len(parsed.questions)},
                )
            db.commit()
            return {**import_job_summary(job), "duplicate": duplicate, "background": True}
        except Exception:
            db.rollback()
            if job is not None:
                delete_staged_source(job.job_id, str((job.result_metadata or {}).get("source_suffix") or ""))
            raise
    return await run_in_threadpool(import_question_bank_data, parsed, subject_id, current_user, db)


@router.post("/question-bank/import/new-subject", status_code=status.HTTP_201_CREATED)
async def import_new_subject_question_bank(
    file: UploadFile = File(...),
    confirm: bool = Form(...),
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Create the file's Subject and import its Question Bank after confirmation."""

    del role_check
    content = await file.read()
    parsed = await run_in_threadpool(_parse_question_bank_content, file.filename, content)
    if should_background_import(len(parsed.questions)):
        admin = await run_in_threadpool(_admin, db, current_user["school_id"])
        if not confirm:
            raise HTTPException(status_code=400, detail="Creating a new Subject requires explicit confirmation")
        job = None
        try:
            job, duplicate = await run_in_threadpool(
                queue_import_job,
                db,
                job_type=BackgroundJobType.question_import,
                requested_by=admin.school_id,
                filename=file.filename,
                content=content,
                total_rows=len(parsed.questions),
                scope=f"new-subject:{parsed.subject.subject_id}",
                metadata={"subject_id": parsed.subject.subject_id, "new_subject": True},
            )
            if not duplicate:
                record_audit(
                    db, actor_school_id=admin.school_id, actor_role=admin.role,
                    action="QUESTION_IMPORT_QUEUED", entity_type="background_job", entity_id=job.job_id,
                    metadata={"subject_id": parsed.subject.subject_id, "job_id": job.job_id, "row_count": len(parsed.questions), "new_subject": True},
                )
            db.commit()
            return {**import_job_summary(job), "duplicate": duplicate, "background": True}
        except Exception:
            db.rollback()
            if job is not None:
                delete_staged_source(job.job_id, str((job.result_metadata or {}).get("source_suffix") or ""))
            raise
    return await run_in_threadpool(
        import_new_subject_question_bank_data, parsed, confirm, current_user, db
    )


@router.get("/question-bank")
def list_central_question_bank(
    subject_id: str | None = None,
    chapter_id: int | None = None,
    lo_id: int | None = None,
    search: str | None = None,
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
    query = _question_query(db).filter(Question.question_status == QuestionStatus.approved)
    query = _apply_question_filters(query, subject_id, chapter_id, lo_id, search, question_type, difficulty)
    total = query.with_entities(func.count(func.distinct(Question.question_id))).scalar() or 0
    questions = (
        query.group_by(Question.question_id)
        .order_by(Question.question_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [_serialize_question(question, include_options=False) for question in questions],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/question-bank/subjects")
def list_central_question_bank_subjects(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    rows = (
        db.query(
            Subject.subject_id,
            Subject.subject_name,
            Subject.subject_description,
            func.count(Question.question_id).label("approved_question_count"),
        )
        .outerjoin(
            Question,
            (Subject.subject_id == Question.subject_id)
            & (Question.question_status == QuestionStatus.approved),
        )
        .group_by(Subject.subject_id, Subject.subject_name, Subject.subject_description)
        .order_by(Subject.subject_name)
        .all()
    )
    return [
        {
            "subject_id": row.subject_id,
            "subject_name": row.subject_name,
            "subject_description": row.subject_description,
            "approved_question_count": row.approved_question_count,
        }
        for row in rows
    ]


@router.get("/question-bank/subjects/{subject_id}/chapters")
def list_central_question_bank_chapters(
    subject_id: str,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    if not db.query(Subject.subject_id).filter(Subject.subject_id == subject_id).first():
        raise HTTPException(status_code=404, detail="Subject not found")
    return [
        {"chapter_id": chapter.chapter_id, "chapter_name": chapter.chapter_name}
        for chapter in db.query(Chapter).filter(Chapter.subject_id == subject_id).order_by(Chapter.chapter_name).all()
    ]


@router.get("/question-bank/chapters/{chapter_id}/learning-objectives")
def list_central_question_bank_learning_objectives(
    chapter_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    if not db.query(Chapter.chapter_id).filter(Chapter.chapter_id == chapter_id).first():
        raise HTTPException(status_code=404, detail="Chapter not found")
    return [
        {"lo_id": lo.lo_id, "lo_name": lo.lo_name}
        for lo in db.query(LO).join(ChapterLO, LO.lo_id == ChapterLO.lo_id).filter(
            ChapterLO.chapter_id == chapter_id
        ).order_by(LO.lo_name).all()
    ]


@router.get("/question-bank/{question_id}")
def get_central_question_detail(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    question = _question_query(db).filter(
        Question.question_id == question_id,
        Question.question_status == QuestionStatus.approved,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Approved question not found")
    return _serialize_question(question)


@router.post("/question-bank", status_code=status.HTTP_201_CREATED)
def create_central_question(
    payload: RevisionSnapshotPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _admin(db, current_user["school_id"])
        chapters, los = _validate_snapshot(db, payload)
        question = Question(
            question_text=payload.question_text,
            question_type=payload.question_type,
            question_difficulties=payload.question_difficulties,
            subject_id=payload.subject_id,
            created_by=admin.school_id,
            question_status=QuestionStatus.approved,
        )
        db.add(question)
        db.flush()
        _replace_taxonomy(db, question, chapters, los)
        _replace_options(db, question, payload)
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="QUESTION_CREATED", entity_type="question", entity_id=question.question_id,
            metadata={"subject_id": question.subject_id, "question_type": _value(question.question_type), "question_status": _question_status(question)},
        )
        db.commit()
        return _serialize_question(_question_query(db).filter(Question.question_id == question.question_id).one())
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question could not be created") from exc


@router.put("/question-bank/{question_id}")
def update_central_question(
    question_id: int,
    payload: RevisionSnapshotPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _admin(db, current_user["school_id"])
        question = _locked_question(db, question_id)
        if _question_status(question) != "approved":
            raise HTTPException(status_code=409, detail="Only approved central questions can be edited")
        chapters, los = _validate_snapshot(db, payload)
        _replace_options(db, question, payload)
        _apply_snapshot(question, payload)
        _replace_taxonomy(db, question, chapters, los)
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="QUESTION_UPDATED", entity_type="question", entity_id=question.question_id,
            metadata={
                "subject_id": question.subject_id,
                "question_type": _value(question.question_type),
                "question_status": _question_status(question),
                "changed_fields": sorted(payload.model_fields_set),
            },
        )
        db.commit()
        db.expire_all()
        return _serialize_question(_question_query(db).filter(Question.question_id == question_id).one())
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question could not be updated because referenced data is in use") from exc


@router.delete("/question-bank/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_central_question(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _admin(db, current_user["school_id"])
        question = _locked_question(db, question_id)
        if _question_status(question) != "approved":
            raise HTTPException(status_code=409, detail="Only approved central questions can be deleted")
        _ensure_question_can_be_deleted(db, question)
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="QUESTION_DELETED", entity_type="question", entity_id=question.question_id,
            metadata={"subject_id": question.subject_id, "question_type": _value(question.question_type), "question_status": _question_status(question)},
        )
        db.delete(question)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Question is referenced and cannot be deleted") from exc


@router.get("/questions/pending")
def list_pending_questions(
    search: str | None = None,
    subject_id: str | None = None,
    teacher_school_id: str | None = None,
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
    if teacher_school_id is not None:
        query = query.filter(Question.created_by == teacher_school_id)
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
                admin.school_id, datetime.now(), None,
            ))
        db.query(QuestionRevision).filter(
            QuestionRevision.question_id == question.question_id,
            QuestionRevision.question_status == "rejected",
        ).update({"rejection_reason": None}, synchronize_session=False)
        question.question_status = QuestionStatus.approved
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="QUESTION_APPROVED", entity_type="question", entity_id=question.question_id,
            metadata={"question_id": question.question_id, "subject_id": question.subject_id},
        )
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
            admin.school_id, datetime.now(), reason,
        ))
        question.question_status = QuestionStatus.rejected
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="QUESTION_REJECTED", entity_type="question", entity_id=question.question_id,
            metadata={"question_id": question.question_id, "subject_id": question.subject_id, "reason": reason[:500]},
        )
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
    editor_school_id: str | None = None,
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
    if editor_school_id is not None:
        query = query.filter(QuestionRevision.edited_by == editor_school_id)
    if question_type:
        query = query.filter(QuestionRevision.question_type == question_type)
    if difficulty:
        query = query.filter(QuestionRevision.question_difficulties == difficulty)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.outerjoin(User, QuestionRevision.edited_by == User.school_id).filter(
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
        revision.approved_by = admin.school_id
        revision.approved_at = datetime.now()
        revision.rejection_reason = None
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="QUESTION_REVISION_APPROVED", entity_type="question_revision", entity_id=revision.revision_id,
            metadata={"question_id": question.question_id, "revision_id": revision.revision_id, "subject_id": revision.subject_id},
        )
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
        revision.approved_by = admin.school_id
        revision.approved_at = datetime.now()
        revision.rejection_reason = reason
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="QUESTION_REVISION_REJECTED", entity_type="question_revision", entity_id=revision.revision_id,
            metadata={"question_id": revision.question_id, "revision_id": revision.revision_id, "subject_id": revision.subject_id, "reason": reason[:500]},
        )
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
    if len(email) > 100:
        raise HTTPException(status_code=400, detail="Email must be at most 100 characters")
    return email


def _valid_text(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_name} is required")
    return cleaned


def _valid_limited_text(value: str, field_name: str, max_length: int) -> str:
    cleaned = _valid_text(value, field_name)
    if len(cleaned) > max_length:
        raise HTTPException(status_code=400, detail=f"{field_name} must be at most {max_length} characters")
    return cleaned


def _valid_password(value: str) -> str:
    if len(value) < 8 or not value.strip():
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(value) > 128:
        raise HTTPException(status_code=400, detail="Password must be at most 128 characters")
    return value


def _valid_phone(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    phone = value.strip()
    if not re.fullmatch(r"[0-9+()\-\s]{7,20}", phone):
        raise HTTPException(status_code=400, detail="Phone number format is invalid")
    return phone


def _valid_user_role(value: str | UserRole) -> UserRole:
    try:
        return UserRole(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Role must be student, teacher, or admin") from exc


@dataclass(frozen=True)
class ValidatedAdminUserInput:
    school_id: str
    full_name: str
    email: str
    password: str
    role: UserRole
    phone: str | None
    date_of_birth: date | None


def validate_admin_user_input(
    db: Session,
    *,
    school_id: str,
    full_name: str,
    email: str,
    initial_password: str,
    role: str | UserRole,
    phone: str | None = None,
    date_of_birth: date | None = None,
) -> ValidatedAdminUserInput:
    """Normalize and validate account data without committing a transaction."""
    normalized = ValidatedAdminUserInput(
        school_id=_valid_limited_text(school_id, "School ID", 30),
        full_name=_valid_limited_text(full_name, "Full name", 100),
        email=_valid_email(email),
        password=_valid_password(initial_password),
        role=_valid_user_role(role),
        phone=_valid_phone(phone),
        date_of_birth=date_of_birth,
    )
    if db.query(User.id).filter(User.school_id == normalized.school_id).first():
        raise HTTPException(status_code=409, detail="School ID already exists")
    if db.query(User.id).filter(User.email == normalized.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    return normalized


def build_new_user(
    db: Session,
    *,
    school_id: str,
    full_name: str,
    email: str,
    initial_password: str,
    role: str | UserRole,
    phone: str | None = None,
    date_of_birth: date | None = None,
) -> User:
    """Build an uncommitted User so future imports can use one transaction."""
    validated = validate_admin_user_input(
        db,
        school_id=school_id,
        full_name=full_name,
        email=email,
        initial_password=initial_password,
        role=role,
        phone=phone,
        date_of_birth=date_of_birth,
    )
    return User(
        school_id=validated.school_id,
        full_name=validated.full_name,
        email=validated.email,
        password_hash=generate_password_hash(validated.password),
        role=validated.role,
        phone=validated.phone,
        date_of_birth=validated.date_of_birth,
    )


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


def _deactivate_teacher_subjects(db: Session, school_id: str) -> None:
    db.query(TeacherSubject).filter(
        TeacherSubject.teacher_id == school_id,
        TeacherSubject.is_active.is_(True),
    ).update({TeacherSubject.is_active: False}, synchronize_session=False)


def _management_admin(db: Session, current_user: dict) -> User:
    return _admin(db, current_user["school_id"])


def _audit_datetime(value: datetime | date | None, *, end_of_day: bool = False) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.combine(value, time.max if end_of_day else time.min)


def _audit_actor(row: AuditLog, actor: User | None) -> dict:
    if row.actor_school_id is None:
        return {"school_id": None, "full_name": "System", "role": "system"}
    return {
        "school_id": row.actor_school_id,
        "full_name": actor.full_name if actor else None,
        "role": _user_role(actor) if actor else row.actor_role,
    }


def _audit_query(
    db: Session, *, search: str | None = None, actor_role: str | None = None,
    category: str | None = None, action: str | None = None, outcome: str | None = None,
    date_from: datetime | date | None = None, date_to: datetime | date | None = None,
):
    actor = aliased(User)
    query = db.query(AuditLog, actor).outerjoin(actor, AuditLog.actor_school_id == actor.school_id)
    query = query.filter(~AuditLog.action.in_(hidden_audit_actions()))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            AuditLog.actor_school_id.ilike(term), actor.full_name.ilike(term), AuditLog.action.ilike(term),
            AuditLog.entity_type.ilike(term), AuditLog.entity_id.ilike(term), AuditLog.request_id.ilike(term),
        ))
    if actor_role:
        query = query.filter(AuditLog.actor_role == actor_role.strip().lower())
    if action:
        query = query.filter(AuditLog.action == action.strip().upper())
    if outcome:
        normalized_outcome = outcome.strip().upper()
        if normalized_outcome not in {"SUCCESS", "FAILED"}:
            raise HTTPException(status_code=422, detail="outcome must be SUCCESS or FAILED")
        query = query.filter(AuditLog.outcome == normalized_outcome)
    if category:
        category_actions = [item["code"] for item in visible_audit_actions() if item["category"] == category.strip().upper()]
        query = query.filter(AuditLog.action.in_(category_actions or ["__NO_SUCH_AUDIT_ACTION__"]))
    if (start := _audit_datetime(date_from)) is not None:
        query = query.filter(AuditLog.created_at >= start)
    if (end := _audit_datetime(date_to, end_of_day=True)) is not None:
        query = query.filter(AuditLog.created_at <= end)
    return query


def _serialize_audit_item(row: AuditLog, actor: User | None, *, detail: bool = False) -> dict:
    info = audit_action_info(row.action)
    result = {
        "audit_log_id": row.audit_log_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "actor": _audit_actor(row, actor),
        "action": row.action,
        "action_label": info["label"],
        "category": info["category"],
        "entity": {"type": row.entity_type, "id": row.entity_id},
        "outcome": row.outcome,
        "request_id": row.request_id,
    }
    if detail:
        result.update({
            "entity_type": row.entity_type, "entity_id": row.entity_id,
            "client_ip": row.client_ip, "user_agent": row.user_agent,
            "metadata": sanitize_metadata(row.metadata_json),
        })
    return result


@router.get("/audit-logs/actions")
def audit_log_actions(current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _management_admin(db, current_user)
    actions = visible_audit_actions()
    return {"actions": actions, "categories": sorted({item["category"] for item in actions})}


@router.get("/audit-logs/stats")
def audit_log_stats(current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _management_admin(db, current_user)
    visible = ~AuditLog.action.in_(hidden_audit_actions())
    since = datetime.now() - timedelta(hours=24)
    return {
        "total_events": db.query(func.count(AuditLog.audit_log_id)).filter(visible).scalar() or 0,
        "events_last_24h": db.query(func.count(AuditLog.audit_log_id)).filter(visible, AuditLog.created_at >= since).scalar() or 0,
        "admin_actions": db.query(func.count(AuditLog.audit_log_id)).filter(visible, AuditLog.actor_role == "admin").scalar() or 0,
        "teacher_actions": db.query(func.count(AuditLog.audit_log_id)).filter(visible, AuditLog.actor_role == "teacher").scalar() or 0,
        "failed_operations": db.query(func.count(AuditLog.audit_log_id)).filter(visible, AuditLog.outcome == "FAILED").scalar() or 0,
    }


@router.get("/audit-logs/export")
def export_audit_logs(
    search: str | None = None, actor_role: str | None = None, category: str | None = None,
    action: str | None = None, outcome: str | None = None, date_from: datetime | date | None = None,
    date_to: datetime | date | None = None, current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db),
):
    del role_check
    _management_admin(db, current_user)
    query = _audit_query(db, search=search, actor_role=actor_role, category=category, action=action, outcome=outcome, date_from=date_from, date_to=date_to)
    if query.count() > 5000:
        raise HTTPException(status_code=422, detail="Export is limited to 5000 matching audit logs")
    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Actor Name", "School ID", "Role", "Action", "Category", "Entity Type", "Entity ID", "Outcome", "Request ID", "Client IP"])
    for row, actor in query.order_by(AuditLog.created_at.desc(), AuditLog.audit_log_id.desc()).all():
        actor_data = _audit_actor(row, actor)
        values = [row.created_at.isoformat() if row.created_at else "", actor_data["full_name"] or "", actor_data["school_id"] or "", actor_data["role"] or "", row.action, audit_action_info(row.action)["category"], row.entity_type, row.entity_id, row.outcome, row.request_id or "", row.client_ip or ""]
        writer.writerow([f"'{value}" if isinstance(value, str) and value[:1] in {"=", "+", "-", "@"} else value for value in values])
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=audit-logs.csv"})


@router.get("/audit-logs")
def list_audit_logs(
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), search: str | None = None,
    actor_role: str | None = None, category: str | None = None, action: str | None = None, outcome: str | None = None,
    date_from: datetime | date | None = None, date_to: datetime | date | None = None,
    current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db),
):
    del role_check
    _management_admin(db, current_user)
    query = _audit_query(db, search=search, actor_role=actor_role, category=category, action=action, outcome=outcome, date_from=date_from, date_to=date_to)
    total = query.order_by(None).count()
    rows = query.order_by(AuditLog.created_at.desc(), AuditLog.audit_log_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_serialize_audit_item(row, actor) for row, actor in rows], "page": page, "page_size": page_size, "total": total}


@router.get("/audit-logs/{audit_log_id}")
def get_audit_log(audit_log_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _management_admin(db, current_user)
    actor = aliased(User)
    row = db.query(AuditLog, actor).outerjoin(actor, AuditLog.actor_school_id == actor.school_id).filter(AuditLog.audit_log_id == audit_log_id, ~AuditLog.action.in_(hidden_audit_actions())).first()
    if not row:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return _serialize_audit_item(*row, detail=True)


@router.get("/users")
def list_users(
    search: Annotated[str | None, Query(max_length=100)] = None,
    role: AdminUserRole | None = None,
    locked: bool | None = None,
    joined_from: Annotated[str | None, Query()] = None,
    joined_to: Annotated[str | None, Query()] = None,
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
    if joined_from:
        from datetime import datetime
        try:
            from_date = datetime.fromisoformat(joined_from).date()
            query = query.filter(User.created_at >= from_date)
        except (ValueError, TypeError):
            pass
    if joined_to:
        from datetime import datetime, timedelta
        try:
            to_date = datetime.fromisoformat(joined_to).date()
            # Include the entire to_date day by adding 1 day
            query = query.filter(User.created_at < to_date + timedelta(days=1))
        except (ValueError, TypeError):
            pass
    total = query.count()
    users = query.order_by(User.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_serialize_admin_user(user) for user in users], "total": total, "page": page, "page_size": page_size}


def build_user_import_preview(rows: list[ParsedUserImportRow], db: Session) -> dict:
    """Validate parsed rows; auto-generate school_id from role if missing."""
    # Auto-generate school_id from role if empty; check for duplicates
    from sqlalchemy import func
    
    def _generate_school_id(role: str, prefix_counts: dict[str, int]) -> str:
        prefix = str(role or "").strip().lower()[0].upper() if role else "U"
        prefix_counts[prefix] = prefix_counts.get(prefix, 0) + 1
        return f"{prefix}{prefix_counts[prefix]:05d}"
    
    # Initialize prefix_counts from existing database school_ids
    prefix_counts: dict[str, int] = {}
    all_prefixes = ['S', 'T', 'A', 'U']
    for prefix in all_prefixes:
        # Find the highest number for each prefix in the database
        result = db.query(func.max(User.school_id)).filter(
            User.school_id.like(f"{prefix}%")
        ).scalar()
        if result:
            try:
                # Extract the numeric part and use it as the starting count
                numeric_part = int(result[1:] or "0")
                prefix_counts[prefix] = numeric_part
            except (ValueError, IndexError):
                prefix_counts[prefix] = 0
        else:
            prefix_counts[prefix] = 0
    
    for row in rows:
        school = str(row.values.get("school_id") or "").strip()
        if not school:
            role = str(row.values.get("role") or "").strip()
            row.values["school_id"] = _generate_school_id(role, prefix_counts)
        else:
            prefix = school[0].upper()
            try:
                numeric_part = int(school[1:] or "0")
                prefix_counts[prefix] = max(prefix_counts.get(prefix, 0), numeric_part)
            except (ValueError, IndexError):
                pass

    school_rows: dict[str, list[ParsedUserImportRow]] = {}
    email_rows: dict[str, list[ParsedUserImportRow]] = {}
    for row in rows:
        school = str(row.values["school_id"] or "").strip()
        email = str(row.values["email"] or "").strip().lower()
        if school:
            school_rows.setdefault(school, []).append(row)
        if email:
            email_rows.setdefault(email, []).append(row)
    for grouped, label in ((school_rows, "School ID"), (email_rows, "Email")):
        for value, duplicates in grouped.items():
            if len(duplicates) > 1:
                for row in duplicates:
                    row.errors.append(f"{label} is duplicated in the uploaded file")

    existing_school_ids = {
        value[0] for value in db.query(User.school_id).filter(User.school_id.in_(school_rows)).all()
    } if school_rows else set()
    existing_emails = {
        value[0].lower() for value in db.query(User.email).filter(User.email.in_(email_rows)).all()
    } if email_rows else set()

    result_rows = []
    for row in rows:
        values = row.values
        school_id = str(values["school_id"] or "").strip()
        email = str(values["email"] or "").strip().lower()
        if school_id in existing_school_ids:
            row.errors.append("School ID already exists")
        if email in existing_emails:
            row.errors.append("Email already exists")
        try:
            validate_admin_user_input(
                db, school_id=str(values["school_id"] or ""), full_name=str(values["full_name"] or ""),
                email=str(values["email"] or ""), initial_password=str(values["initial_password"] or ""),
                role=str(values["role"] or "").strip().lower(), phone=None if values["phone"] is None else str(values["phone"]),
                date_of_birth=values["date_of_birth"],
            )
        except HTTPException as exc:
            row.errors.append(str(exc.detail))
        row.errors = list(dict.fromkeys(row.errors))
        role = str(values["role"] or "").strip().lower()
        warnings = ["This row will create an administrator account."] if role == "admin" else []
        status_value = "invalid" if row.errors else "valid"
        result_rows.append({
            "row_number": row.row_number, "school_id": str(values["school_id"] or "").strip(),
            "full_name": str(values["full_name"] or "").strip(), "email": str(values["email"] or "").strip().lower(),
            "role": role, "phone": None if values["phone"] is None else str(values["phone"]).strip(),
            "date_of_birth": values["date_of_birth"].isoformat() if isinstance(values["date_of_birth"], date) else None,
            "status": status_value, "errors": row.errors, "warnings": warnings,
        })
    return {"total_rows": len(result_rows), "valid_count": sum(row["status"] == "valid" for row in result_rows),
            "warning_count": sum(len(row["warnings"]) for row in result_rows),
            "error_count": sum(row["status"] == "invalid" for row in result_rows), "rows": result_rows}


@router.post("/users/import/preview")
async def preview_user_import(
    file: UploadFile = File(...), current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db),
):
    del role_check
    await run_in_threadpool(_management_admin, db, current_user)
    if not file.filename or not file.filename.casefold().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="The uploaded file must not exceed 5 MB")
    try:
        preview = await run_in_threadpool(_build_user_import_preview, content, db)
    except UserImportParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"file_name": file.filename, **preview}


def _build_user_import_preview(content: bytes, db: Session) -> dict:
    """Parse and validate an uploaded workbook in a worker thread."""

    return build_user_import_preview(parse_user_import_xlsx(content), db)


def import_users_from_rows(
    rows: list[ParsedUserImportRow], db: Session, *, commit: bool = True, audit_actor: User | None = None,
) -> dict:
    """Persist an already reparsed batch in one transaction after strict validation."""
    preview = build_user_import_preview(rows, db)
    if preview["error_count"]:
        raise HTTPException(status_code=400, detail={"message": "Import validation failed", "preview": preview})
    try:
        users = []
        # Validation queries must not autoflush earlier rows; all inserts flush together below.
        with db.no_autoflush:
            for row in rows:
                values = row.values
                user = build_new_user(
                    db,
                    school_id=str(values["school_id"] or ""), full_name=str(values["full_name"] or ""),
                    email=str(values["email"] or ""), initial_password=str(values["initial_password"] or ""),
                    role=str(values["role"] or "").strip().lower(),
                    phone=None if values["phone"] is None else str(values["phone"]),
                    date_of_birth=values["date_of_birth"],
                )
                db.add(user)
                users.append(user)
        db.flush()
        role_counts = {role: sum(_user_role(user) == role for user in users) for role in ("student", "teacher", "admin")}
        if commit:
            if audit_actor is not None:
                record_audit(
                    db, actor_school_id=audit_actor.school_id, actor_role=audit_actor.role,
                    action="USER_IMPORT_COMPLETED", entity_type="user_import", entity_id="batch",
                    metadata={"imported_count": len(users), "role_counts": role_counts},
                )
            db.commit()
        return {"success": True, "imported_count": len(users), "role_counts": role_counts}
    except HTTPException:
        if commit:
            db.rollback()
        raise
    except IntegrityError as exc:
        if commit:
            db.rollback()
        raise HTTPException(status_code=409, detail="Import conflicts with an existing school ID or email") from exc


@router.post("/users/import")
async def import_users(
    file: UploadFile = File(...), current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db),
):
    del role_check
    admin = await run_in_threadpool(_management_admin, db, current_user)
    if not file.filename or not file.filename.casefold().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="The uploaded file must not exceed 5 MB")
    try:
        rows = await run_in_threadpool(parse_user_import_xlsx, content)
    except UserImportParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if should_background_import(len(rows)):
        admin = await run_in_threadpool(_management_admin, db, current_user)
        job = None
        try:
            job, duplicate = await run_in_threadpool(
                queue_import_job,
                db,
                job_type=BackgroundJobType.user_import,
                requested_by=admin.school_id,
                filename=file.filename,
                content=content,
                total_rows=len(rows),
                scope="users",
            )
            if not duplicate:
                record_audit(
                    db, actor_school_id=admin.school_id, actor_role=admin.role,
                    action="USER_IMPORT_QUEUED", entity_type="background_job", entity_id=job.job_id,
                    metadata={"job_id": job.job_id, "row_count": len(rows)},
                )
            db.commit()
            return {**import_job_summary(job), "duplicate": duplicate, "background": True}
        except Exception:
            db.rollback()
            if job is not None:
                delete_staged_source(job.job_id, str((job.result_metadata or {}).get("source_suffix") or ""))
            raise
    return await run_in_threadpool(import_users_from_rows, rows, db, audit_actor=admin)


_BULK_REQUEST_RESULT_KEYS = {
    "imported_count", "duplicate_skipped_count", "chapters_created", "learning_objectives_created",
    "role_counts", "message", "total_rows", "success_rows", "failed_rows",
}


def _safe_bulk_request_result(metadata: object) -> dict | None:
    if not isinstance(metadata, dict):
        return None
    return {
        key: value for key, value in metadata.items()
        if key in _BULK_REQUEST_RESULT_KEYS and isinstance(value, (str, int, float, bool, dict, type(None)))
    } or None


def _serialize_bulk_data_request(item: BulkDataRequest, db: Session) -> dict:
    subject = db.get(Subject, item.subject_id) if item.subject_id else None
    return {
        "request_id": item.request_id,
        "request_type": _value(item.request_type),
        "status": _value(item.status),
        "requested_by": item.requested_by,
        "subject": _subject_summary(subject),
        "original_filename": item.original_filename,
        "file_size": item.file_size,
        "teacher_note": item.teacher_note,
        "admin_note": item.admin_note,
        "processed_by": item.processed_by,
        "processed_at": item.processed_at.isoformat() if item.processed_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "result_metadata": _safe_bulk_request_result(item.result_metadata),
    }


def _locked_bulk_data_request(db: Session, request_id: int) -> BulkDataRequest:
    item = db.query(BulkDataRequest).filter(BulkDataRequest.request_id == request_id).with_for_update().first()
    if not item:
        raise HTTPException(status_code=404, detail="Bulk data request not found")
    return item


def _bulk_request_source(item: BulkDataRequest) -> bytes:
    if not item.stored_file_key or not bulk_request_storage.exists(item.stored_file_key):
        raise HTTPException(status_code=410, detail="The submitted file is no longer available")
    if not bulk_request_storage.verify_sha256(item.stored_file_key, item.sha256):
        raise HTTPException(status_code=409, detail="The submitted file failed its integrity check")
    return bulk_request_storage.read(item.stored_file_key)


def _parse_bulk_question_request(item: BulkDataRequest, content: bytes) -> ParsedQuestionBank:
    return _parse_question_bank_content(item.original_filename, content)


def _cleanup_terminal_bulk_request_file(db: Session, item: BulkDataRequest) -> None:
    """Best-effort post-commit cleanup; a filesystem failure never rolls back imports."""
    if not item.stored_file_key:
        return
    key = item.stored_file_key
    try:
        if not bulk_request_storage.delete(key):
            return
    except Exception:
        return
    try:
        persisted = db.get(BulkDataRequest, item.request_id, with_for_update=True)
        if persisted and persisted.stored_file_key == key:
            persisted.stored_file_key = None
            db.commit()
    except Exception:
        db.rollback()


def preview_bulk_data_request(db: Session, request_id: int, current_user: dict) -> dict:
    _admin(db, current_user["school_id"])
    item = db.get(BulkDataRequest, request_id)
    if not item:
        raise HTTPException(status_code=404, detail="Bulk data request not found")
    content = _bulk_request_source(item)
    if item.request_type == BulkDataRequestType.question_bank:
        if not item.subject_id:
            raise HTTPException(status_code=409, detail="Question request is missing its selected subject")
        parsed = _parse_bulk_question_request(item, content)
        return {"request": _serialize_bulk_data_request(item, db), "preview": build_question_bank_import_preview(parsed, item.subject_id, current_user, db)}
    if item.request_type == BulkDataRequestType.user_import:
        try:
            rows = parse_user_import_xlsx(content)
        except UserImportParseError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return {"request": _serialize_bulk_data_request(item, db), "preview": build_user_import_preview(rows, db)}
    raise HTTPException(status_code=409, detail="Unsupported bulk data request type")


def process_bulk_data_request(db: Session, request_id: int, current_user: dict) -> dict:
    """Import one pending Teacher request, or queue its existing background importer."""
    admin = _admin(db, current_user["school_id"])
    item = _locked_bulk_data_request(db, request_id)
    if item.status not in {BulkDataRequestStatus.pending, BulkDataRequestStatus.failed}:
        raise HTTPException(status_code=409, detail="Only pending or failed bulk data requests can be imported")
    # A failed job is terminal. A retry must use a new durable job/outbox event,
    # never relabel the old failed job as processing.
    retry_token = uuid4().hex if item.status == BulkDataRequestStatus.failed else None
    try:
        # MySQL's row lock is the primary cross-instance guard. This CAS also
        # rejects stale sessions instead of allowing a second terminal path.
        transitioned = db.execute(
            update(BulkDataRequest)
            .where(
                BulkDataRequest.request_id == item.request_id,
                BulkDataRequest.status == item.status,
            )
            .values(status=BulkDataRequestStatus.processing)
        )
        if transitioned.rowcount != 1:
            raise HTTPException(status_code=409, detail="Bulk data request state changed; refresh and retry")
        db.refresh(item)
        content = _bulk_request_source(item)
        if item.request_type == BulkDataRequestType.question_bank:
            if not item.subject_id:
                raise HTTPException(status_code=409, detail="Question request is missing its selected subject")
            require_active_subject_assignment(db, item.requested_by, item.subject_id)
            parsed = _parse_bulk_question_request(item, content)
            preview = build_question_bank_import_preview(parsed, item.subject_id, current_user, db)
            if preview["summary"]["error_questions"]:
                raise HTTPException(status_code=400, detail={"message": "Import validation failed", "preview": preview})
            if should_background_import(len(parsed.questions)):
                job, _ = queue_import_job(
                    db, job_type=BackgroundJobType.question_import, requested_by=admin.school_id,
                    filename=item.original_filename, content=content, total_rows=len(parsed.questions),
                    scope=f"bulk-request:{item.request_id}:subject:{item.subject_id}" + (f":retry:{retry_token}" if retry_token else ""),
                    metadata={"bulk_data_request_id": item.request_id, "question_creator_school_id": item.requested_by, "subject_id": item.subject_id, "new_subject": False},
                )
                item.status = BulkDataRequestStatus.processing
                item.background_job_id = job.job_id
                item.processed_by = admin.school_id
                record_audit(db, actor_school_id=admin.school_id, actor_role=admin.role, action="BULK_DATA_REQUEST_QUEUED", entity_type="bulk_data_request", entity_id=item.request_id, metadata={"job_id": job.job_id, "request_type": item.request_type.value})
                db.commit()
                return {"request": _serialize_bulk_data_request(item, db), "background": True, "job": import_job_summary(job)}
            result = import_question_bank_data(parsed, item.subject_id, current_user, db, creator_school_id=item.requested_by, commit=False)
        elif item.request_type == BulkDataRequestType.user_import:
            try:
                rows = parse_user_import_xlsx(content)
            except UserImportParseError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            preview = build_user_import_preview(rows, db)
            if preview["error_count"]:
                raise HTTPException(status_code=400, detail={"message": "Import validation failed", "preview": preview})
            if should_background_import(len(rows)):
                job, _ = queue_import_job(
                    db, job_type=BackgroundJobType.user_import, requested_by=admin.school_id,
                    filename=item.original_filename, content=content, total_rows=len(rows),
                    scope=f"bulk-request:{item.request_id}:users" + (f":retry:{retry_token}" if retry_token else ""), metadata={"bulk_data_request_id": item.request_id},
                )
                item.status = BulkDataRequestStatus.processing
                item.background_job_id = job.job_id
                item.processed_by = admin.school_id
                record_audit(db, actor_school_id=admin.school_id, actor_role=admin.role, action="BULK_DATA_REQUEST_QUEUED", entity_type="bulk_data_request", entity_id=item.request_id, metadata={"job_id": job.job_id, "request_type": item.request_type.value})
                db.commit()
                return {"request": _serialize_bulk_data_request(item, db), "background": True, "job": import_job_summary(job)}
            result = import_users_from_rows(rows, db, commit=False)
        else:
            raise HTTPException(status_code=409, detail="Unsupported bulk data request type")

        item.status = BulkDataRequestStatus.imported
        item.processed_by = admin.school_id
        item.processed_at = datetime.now()
        item.result_metadata = result
        record_audit(db, actor_school_id=admin.school_id, actor_role=admin.role, action="BULK_DATA_REQUEST_IMPORTED", entity_type="bulk_data_request", entity_id=item.request_id, metadata={"request_type": item.request_type.value, "imported_count": result.get("imported_count", 0)})
        db.commit()
    except Exception:
        db.rollback()
        raise
    _cleanup_terminal_bulk_request_file(db, item)
    return {"request": _serialize_bulk_data_request(item, db), "background": False}


@router.get("/bulk-data-requests")
def list_bulk_data_requests(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _admin(db, current_user["school_id"])
    query = db.query(BulkDataRequest)
    total = query.count()
    items = query.order_by(BulkDataRequest.created_at.desc(), BulkDataRequest.request_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_serialize_bulk_data_request(item, db) for item in items], "page": page, "page_size": page_size, "total": total}


@router.get("/bulk-data-requests/{request_id}")
def get_bulk_data_request(request_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _admin(db, current_user["school_id"])
    item = db.get(BulkDataRequest, request_id)
    if not item:
        raise HTTPException(status_code=404, detail="Bulk data request not found")
    return _serialize_bulk_data_request(item, db)


@router.get("/bulk-data-requests/{request_id}/download")
def download_bulk_data_request(request_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _admin(db, current_user["school_id"])
    item = db.get(BulkDataRequest, request_id)
    if not item:
        raise HTTPException(status_code=404, detail="Bulk data request not found")
    _bulk_request_source(item)
    return Response(
        bulk_request_storage.read(item.stored_file_key), media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{item.original_filename}"'},
    )


@router.post("/bulk-data-requests/{request_id}/preview")
def preview_stored_bulk_data_request(request_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    return preview_bulk_data_request(db, request_id, current_user)


@router.post("/bulk-data-requests/{request_id}/reject")
def reject_bulk_data_request(request_id: int, payload: RejectPayload, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    admin = _admin(db, current_user["school_id"])
    item = _locked_bulk_data_request(db, request_id)
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=422, detail="A rejection reason is required")
    if item.status != BulkDataRequestStatus.pending:
        raise HTTPException(status_code=409, detail="Only pending bulk data requests can be rejected")
    transitioned = db.execute(
        update(BulkDataRequest)
        .where(
            BulkDataRequest.request_id == item.request_id,
            BulkDataRequest.status == BulkDataRequestStatus.pending,
        )
        .values(status=BulkDataRequestStatus.rejected)
    )
    if transitioned.rowcount != 1:
        raise HTTPException(status_code=409, detail="Bulk data request state changed; refresh and retry")
    db.refresh(item)
    item.admin_note = reason
    item.processed_by = admin.school_id
    item.processed_at = datetime.now()
    record_audit(db, actor_school_id=admin.school_id, actor_role=admin.role, action="BULK_DATA_REQUEST_REJECTED", entity_type="bulk_data_request", entity_id=item.request_id, metadata={"request_type": item.request_type.value})
    db.commit()
    _cleanup_terminal_bulk_request_file(db, item)
    return _serialize_bulk_data_request(item, db)


@router.post("/bulk-data-requests/{request_id}/import")
def import_stored_bulk_data_request(request_id: int, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    return process_bulk_data_request(db, request_id, current_user)


def _owned_import_job(db: Session, job_id: int, admin_school_id: str) -> BackgroundJob:
    job = db.get(BackgroundJob, job_id)
    job_type = job.job_type.value if job and hasattr(job.job_type, "value") else (str(job.job_type) if job else "")
    if not job or job_type not in {BackgroundJobType.user_import.value, BackgroundJobType.question_import.value}:
        raise HTTPException(status_code=404, detail="Import job not found")
    if job.requested_by != admin_school_id:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job


@router.get("/import-jobs/{job_id}")
def get_import_job(
    job_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Return only the requesting administrator's import progress."""
    del role_check
    admin = _management_admin(db, current_user)
    return import_job_summary(_owned_import_job(db, job_id, admin.school_id))


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
        admin = _management_admin(db, current_user)
        user = build_new_user(
            db,
            school_id=payload.school_id,
            full_name=payload.full_name,
            email=payload.email,
            initial_password=payload.password,
            role=payload.role,
            phone=payload.phone,
            date_of_birth=payload.date_of_birth,
        )
        db.add(user)
        db.flush()
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="USER_CREATED", entity_type="user", entity_id=user.id,
            metadata={"target_school_id": user.school_id, "target_role": _user_role(user)},
        )
        db.commit()
        db.refresh(user)
        return _serialize_admin_user(user)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="School ID or email already exists") from exc
    except Exception:
        db.rollback()
        raise


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
        changed_fields = sorted(payload.model_fields_set - {"password"})

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
                _deactivate_teacher_subjects(db, user.school_id)
            if _user_role(user) == "admin" and new_role != UserRole.admin:
                _ensure_not_last_active_admin(db, user)
            user.role = new_role
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="USER_UPDATED", entity_type="user", entity_id=user.id,
            metadata={
                "target_school_id": user.school_id,
                "target_role": _user_role(user),
                "changed_fields": changed_fields,
            },
        )
        db.commit()
        db.refresh(user)
        return _serialize_admin_user(user)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="School ID or email already exists") from exc
    except Exception:
        db.rollback()
        raise


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
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="ADMIN_PASSWORD_CHANGED", entity_type="user", entity_id=admin.id,
            metadata={"target_school_id": admin.school_id, "target_role": _user_role(admin)},
        )
        db.commit()
        return {"success": True, "message": "Password changed successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
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
        user.locked_by = admin.school_id
        record_audit(
            db,
            actor_school_id=admin.school_id,
            actor_role=admin.role,
            action="USER_LOCKED",
            entity_type="user",
            entity_id=user.id,
            metadata={"target_school_id": user.school_id},
        )
        db.commit()
        db.refresh(user)
        return _serialize_admin_user(user)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
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
        admin = _management_admin(db, current_user)
        user = _locked_user(db, user_id)
        if not user.is_locked:
            raise HTTPException(status_code=409, detail="User is not locked")
        user.is_locked = False
        user.locked_at = None
        user.locked_by = None
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="USER_UNLOCKED", entity_type="user", entity_id=user.id,
            metadata={"target_school_id": user.school_id, "target_role": _user_role(user)},
        )
        db.commit()
        db.refresh(user)
        return _serialize_admin_user(user)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
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
            _deactivate_teacher_subjects(db, user.school_id)
        user.deleted_at = datetime.now()
        user.deleted_by = admin.school_id
        user.is_locked = True
        user.locked_at = datetime.now()
        user.locked_by = admin.school_id
        record_audit(
            db,
            actor_school_id=admin.school_id,
            actor_role=admin.role,
            action="USER_DELETED",
            entity_type="user",
            entity_id=user.id,
            metadata={"target_school_id": user.school_id, "target_role": _user_role(user)},
        )
        db.commit()
        return None
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/users/{user_id}/restore")
def restore_user(
    user_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Restore a soft-deleted account without re-enabling it implicitly."""
    del role_check
    try:
        admin = _management_admin(db, current_user)
        user = _locked_user(db, user_id, include_deleted=True)
        if user.deleted_at is None:
            raise HTTPException(status_code=409, detail="User is not deleted")
        user.deleted_at = None
        user.deleted_by = None
        # Deletion locks accounts and revokes Teacher subjects. Require the
        # existing explicit unlock/grant actions before reviving old access.
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="USER_RESTORED", entity_type="user", entity_id=user.id,
            metadata={"target_school_id": user.school_id, "target_role": _user_role(user)},
        )
        db.commit()
        db.refresh(user)
        return _serialize_admin_user(user)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


class TeacherPermissionPayload(BaseModel):
    teacher_school_id: str = Field(min_length=1, max_length=30)
    subject_id: str = Field(min_length=1, max_length=20)


class UpdateTeacherPermissionPayload(BaseModel):
    is_active: bool | None = None
    new_subject_id: str | None = Field(default=None, min_length=1, max_length=20)


class ReplaceTeacherPermissionsPayload(BaseModel):
    subject_ids: list[str] = Field(default_factory=list, max_length=100)


def _permission_teacher(db: Session, teacher_school_id: str, *, for_update: bool = False) -> User:
    query = db.query(User).filter(User.school_id == teacher_school_id)
    if for_update:
        # This parent-row lock serializes full permission-set replacements,
        # including the first grant where no TeacherSubject row exists yet.
        query = query.with_for_update()
    teacher = query.first()
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
        "teacher_school_id": item.teacher_id,
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
    search: str | None = None, teacher_school_id: str | None = None, subject_id: str | None = None, is_active: bool | None = None,
    current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db),
):
    del role_check
    _management_admin(db, current_user)
    filters = {
        "search": search.strip() if search and search.strip() else None,
        "teacher_school_id": teacher_school_id,
        "subject_id": subject_id,
        "is_active": is_active,
    }

    def load() -> dict:
        query = db.query(TeacherSubject).join(TeacherSubject.teacher).join(TeacherSubject.subject)
        if filters["search"]:
            term = f"%{filters['search']}%"
            query = query.filter(or_(User.full_name.ilike(term), User.school_id.ilike(term), User.email.ilike(term)))
        if teacher_school_id is not None: query = query.filter(TeacherSubject.teacher_id == teacher_school_id)
        if subject_id: query = query.filter(TeacherSubject.subject_id == subject_id)
        if is_active is not None: query = query.filter(TeacherSubject.is_active.is_(is_active))
        return {"items": [_serialize_teacher_permission(item) for item in query.order_by(TeacherSubject.teacher_id, TeacherSubject.subject_id).all()]}

    # This is a read-heavy administration view, not an authorization decision.
    return cache_aside(admin_teacher_permissions_key(filters), 60, load)


@router.get("/teacher-permissions/teachers")
def list_permission_teachers(current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _management_admin(db, current_user)
    return [{"school_id": user.school_id, "full_name": user.full_name, "email": user.email} for user in db.query(User).filter(User.role == UserRole.teacher, User.deleted_at.is_(None), User.is_locked.is_(False)).order_by(User.full_name, User.id).all()]


@router.get("/teacher-permissions/subjects")
def list_permission_subjects(current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _management_admin(db, current_user)
    return [{"subject_id": subject.subject_id, "subject_name": subject.subject_name} for subject in db.query(Subject).order_by(Subject.subject_name).all()]


@router.get("/teachers/{teacher_school_id}/permissions")
def list_teacher_subject_permissions(teacher_school_id: str, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    _management_admin(db, current_user)
    _permission_teacher(db, teacher_school_id)
    return {"items": [_serialize_teacher_permission(item) for item in db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher_school_id).order_by(TeacherSubject.subject_id).all()]}


@router.patch("/teachers/{teacher_school_id}/permissions")
def replace_teacher_permissions(
    teacher_school_id: str,
    payload: ReplaceTeacherPermissionsPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Atomically replace a teacher's complete active subject-access set."""
    del role_check
    try:
        admin = _management_admin(db, current_user)
        teacher = _permission_teacher(db, teacher_school_id, for_update=True)
        subject_ids = [subject_id.strip() for subject_id in payload.subject_ids]
        if any(not subject_id for subject_id in subject_ids) or len(subject_ids) != len(set(subject_ids)):
            raise HTTPException(status_code=400, detail="Subject IDs must be unique and non-empty")
        subjects = db.query(Subject).filter(Subject.subject_id.in_(subject_ids)).all() if subject_ids else []
        if len(subjects) != len(subject_ids):
            raise HTTPException(status_code=404, detail="One or more subjects were not found")

        existing = {
            item.subject_id: item
            for item in db.query(TeacherSubject)
            .filter(TeacherSubject.teacher_id == teacher.school_id)
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
                item = TeacherSubject(teacher_id=teacher.school_id, subject_id=subject_id, is_active=True, assigned_by=admin.school_id, assigned_at=now)
                db.add(item)
            elif not item.is_active:
                item.is_active = True
                item.assigned_by = admin.school_id
                item.assigned_at = now
        record_audit(
            db,
            actor_school_id=admin.school_id,
            actor_role=admin.role,
            action="TEACHER_PERMISSION_UPDATED",
            entity_type="teacher_permission",
            entity_id=teacher.school_id,
            metadata={
                "active_subject_count": len(requested),
                "invalidation": admin_permission_updated(teacher.school_id).as_event_metadata(),
            },
        )
        enqueue_outbox_event(
            db,
            event_type="analytics.permission_updated",
            aggregate_type="teacher_permission",
            aggregate_id=teacher.school_id,
            metadata={"active_subject_count": len(requested)},
        )
        db.commit()
        deliver_invalidation(admin_permission_updated(teacher.school_id))
        refreshed = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher.school_id).order_by(TeacherSubject.subject_id).all()
        return _serialize_teacher_permission_set(teacher, refreshed)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Teacher permissions could not be updated") from exc
    except Exception:
        db.rollback()
        raise


@router.post("/teacher-permissions", status_code=status.HTTP_201_CREATED)
def grant_teacher_permission(payload: TeacherPermissionPayload, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    try:
        admin = _management_admin(db, current_user); _permission_teacher(db, payload.teacher_school_id); _permission_subject(db, payload.subject_id)
        item = db.query(TeacherSubject).filter(TeacherSubject.teacher_id == payload.teacher_school_id, TeacherSubject.subject_id == payload.subject_id).with_for_update().first()
        if item and item.is_active: raise HTTPException(status_code=409, detail="Teacher already has active permission for this subject")
        if not item:
            item = TeacherSubject(teacher_id=payload.teacher_school_id, subject_id=payload.subject_id); db.add(item)
        item.is_active = True; item.assigned_by = admin.school_id; item.assigned_at = datetime.now()
        record_audit(
            db,
            actor_school_id=admin.school_id,
            actor_role=admin.role,
            action="TEACHER_PERMISSION_UPDATED",
            entity_type="teacher_permission",
            entity_id=payload.teacher_school_id,
            metadata={
                "subject_id": payload.subject_id,
                "is_active": True,
                "invalidation": admin_permission_updated(payload.teacher_school_id).as_event_metadata(),
            },
        )
        db.commit(); deliver_invalidation(admin_permission_updated(payload.teacher_school_id)); db.refresh(item); return _serialize_teacher_permission(item)
    except HTTPException:
        db.rollback(); raise
    except IntegrityError as exc:
        db.rollback(); raise HTTPException(status_code=409, detail="Teacher permission conflicts with an existing assignment") from exc
    except Exception:
        db.rollback(); raise


@router.patch("/teacher-permissions/{teacher_school_id}/{subject_id}")
def update_teacher_permission(teacher_school_id: str, subject_id: str, payload: UpdateTeacherPermissionPayload, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    try:
        admin = _management_admin(db, current_user); _permission_teacher(db, teacher_school_id)
        item = db.query(TeacherSubject).filter_by(teacher_id=teacher_school_id, subject_id=subject_id).with_for_update().first()
        if not item: raise HTTPException(status_code=404, detail="Teacher permission not found")
        if payload.new_subject_id and payload.new_subject_id != subject_id:
            _permission_subject(db, payload.new_subject_id)
            other = db.query(TeacherSubject).filter_by(teacher_id=teacher_school_id, subject_id=payload.new_subject_id).with_for_update().first()
            if other and other.is_active: raise HTTPException(status_code=409, detail="Teacher already has active permission for this subject")
            item.is_active = False
            if other: item = other
            else: item = TeacherSubject(teacher_id=teacher_school_id, subject_id=payload.new_subject_id); db.add(item)
            item.is_active = True
        if payload.is_active is not None: item.is_active = payload.is_active
        item.assigned_by = admin.school_id; item.assigned_at = datetime.now()
        record_audit(
            db,
            actor_school_id=admin.school_id,
            actor_role=admin.role,
            action="TEACHER_PERMISSION_UPDATED",
            entity_type="teacher_permission",
            entity_id=teacher_school_id,
            metadata={
                "subject_id": item.subject_id,
                "is_active": bool(item.is_active),
                "invalidation": admin_permission_updated(teacher_school_id).as_event_metadata(),
            },
        )
        db.commit(); deliver_invalidation(admin_permission_updated(teacher_school_id)); db.refresh(item); return _serialize_teacher_permission(item)
    except HTTPException:
        db.rollback(); raise
    except IntegrityError as exc:
        db.rollback(); raise HTTPException(status_code=409, detail="Teacher permissions could not be updated") from exc
    except Exception:
        db.rollback(); raise


@router.delete("/teacher-permissions/{teacher_school_id}/{subject_id}")
def revoke_teacher_permission(teacher_school_id: str, subject_id: str, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY), db: Session = Depends(get_db)):
    del role_check
    try:
        admin = _management_admin(db, current_user)
        item = db.query(TeacherSubject).filter_by(teacher_id=teacher_school_id, subject_id=subject_id).with_for_update().first()
        if not item: raise HTTPException(status_code=404, detail="Teacher permission not found")
        item.is_active = False
        record_audit(
            db,
            actor_school_id=admin.school_id,
            actor_role=admin.role,
            action="TEACHER_PERMISSION_UPDATED",
            entity_type="teacher_permission",
            entity_id=teacher_school_id,
            metadata={
                "subject_id": subject_id,
                "is_active": False,
                "invalidation": admin_permission_updated(teacher_school_id).as_event_metadata(),
            },
        )
        db.commit(); deliver_invalidation(admin_permission_updated(teacher_school_id)); db.refresh(item); return _serialize_teacher_permission(item)
    except HTTPException:
        db.rollback(); raise


@router.post("/reports/exams/{exam_id}/report-jobs", status_code=status.HTTP_202_ACCEPTED)
def create_admin_exam_results_report_job(
    exam_id: int,
    payload: CreateReportJobPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Queue a durable report job; the transaction owns its outbox event."""
    del role_check
    admin = _admin(db, current_user["school_id"])
    if not db.get(Exam, exam_id):
        raise HTTPException(status_code=404, detail="Exam not found")
    try:
        job, duplicate = request_exam_results_report(
            db, exam_id=exam_id, requested_by=admin.school_id, request_id=payload.request_id,
        )
        db.commit()
        db.refresh(job)
        return {**report_job_summary(job), "duplicate": duplicate}
    except Exception:
        db.rollback()
        raise


# --------------------------------------------------------------------------
# Subject classes
#
# A class carries its own subject_id and teacher_id (there is no join table),
# and those two columns are exactly what gates teacher-side student assignment
# in getExamsRoute._assignment_options. Editing a class here therefore changes
# who a teacher may assign, so payloads are validated against real users and
# subjects rather than trusted from the client.
# --------------------------------------------------------------------------


class ClassTeacherPayload(BaseModel):
    teacher_school_id: str = Field(min_length=1, max_length=30)


class ClassStudentsPayload(BaseModel):
    student_ids: list[str] = Field(min_length=1)


def _class_or_404(db: Session, class_id: int) -> CourseClass:
    course_class = db.get(CourseClass, class_id)
    if not course_class:
        raise HTTPException(status_code=404, detail="Class not found")
    return course_class


def _class_teacher(db: Session, school_id: str) -> User:
    teacher = db.query(User).filter(User.school_id == school_id).first()
    if not teacher or (_value(teacher.role) or "").lower() != "teacher":
        raise HTTPException(status_code=404, detail="Teacher not found")
    if getattr(teacher, "deleted_at", None) is not None:
        raise HTTPException(status_code=422, detail="A deleted account cannot be assigned to a class")
    if getattr(teacher, "is_locked", False):
        raise HTTPException(status_code=422, detail="A locked account cannot be assigned to a class")
    return teacher


def _account_status(user: User) -> str:
    if getattr(user, "deleted_at", None) is not None or getattr(user, "is_locked", False):
        return "inactive"
    return "active"


def _person(user: User | None) -> dict | None:
    if not user:
        return None
    return {
        "school_id": user.school_id,
        "full_name": user.full_name,
        "email": user.email,
        "status": _account_status(user),
    }


def _serialize_class(course_class: CourseClass, student_count: int) -> dict:
    return {
        "class_id": course_class.class_id,
        "class_name": course_class.class_name,
        "subject_id": course_class.subject_id,
        "subject_name": course_class.subject.subject_name if course_class.subject else None,
        "teacher": _person(course_class.teacher),
        "student_count": student_count,
    }


def _subject_enrolment_map(db: Session, subject_id: str, exclude_class_id: int) -> dict[str, CourseClass]:
    """Student -> the other class of this subject they already sit in.

    A student may only attend one class per subject, and the schema cannot
    express that (the subject lives on class, not on student_class), so it is
    enforced here and surfaced to the UI.
    """
    rows = (
        db.query(StudentClass.student_id, CourseClass)
        .join(CourseClass, CourseClass.class_id == StudentClass.class_id)
        .filter(
            CourseClass.subject_id == subject_id,
            CourseClass.class_id != exclude_class_id,
        )
        .all()
    )
    return {student_id: course_class for student_id, course_class in rows}


def _lock_subject_classes(db: Session, subject_id: str) -> None:
    """Serialize class roster changes for one subject until schema can enforce it."""
    # Lock the parent as well so an empty subject's first class is serialized.
    db.query(Subject.subject_id).filter(Subject.subject_id == subject_id).with_for_update().one()
    db.query(CourseClass.class_id).filter(CourseClass.subject_id == subject_id).with_for_update().all()


def _ensure_subject_permission(db: Session, teacher_school_id: str, subject_id: str, admin: User) -> bool:
    """Owning a class implies working with that subject's question bank, so the
    teacher_subject grant is created (or reactivated) alongside the assignment.

    Returns True when this call actually changed something. Does not commit.
    """
    item = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id == teacher_school_id,
            TeacherSubject.subject_id == subject_id,
        )
        .with_for_update()
        .first()
    )
    if item and item.is_active:
        return False
    if not item:
        item = TeacherSubject(teacher_id=teacher_school_id, subject_id=subject_id)
        db.add(item)
    item.is_active = True
    item.assigned_by = admin.school_id
    item.assigned_at = datetime.now()
    return True


def _active_subject_teacher_ids(db: Session, subject_id: str) -> set[str]:
    """Teachers who also hold question-bank access for the subject (teacher_subject)."""
    return {
        row[0]
        for row in db.query(TeacherSubject.teacher_id)
        .filter(TeacherSubject.subject_id == subject_id, TeacherSubject.is_active.is_(True))
        .all()
    }


@router.get("/classes")
def list_classes(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _management_admin(db, current_user)
    counts = dict(
        db.query(StudentClass.class_id, func.count(StudentClass.student_id))
        .group_by(StudentClass.class_id)
        .all()
    )
    classes = (
        db.query(CourseClass)
        .options(selectinload(CourseClass.subject), selectinload(CourseClass.teacher))
        .order_by(CourseClass.subject_id, CourseClass.class_name, CourseClass.class_id)
        .all()
    )
    return {"items": [_serialize_class(item, counts.get(item.class_id, 0)) for item in classes]}


@router.get("/classes/teachers")
def list_class_teachers(
    subject_id: str | None = None,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Assignable teachers, flagged with whether they also hold the subject question-bank access."""
    del role_check
    _management_admin(db, current_user)
    permitted = _active_subject_teacher_ids(db, subject_id) if subject_id else set()
    teachers = (
        db.query(User)
        .filter(User.role == UserRole.teacher, User.deleted_at.is_(None))
        .order_by(User.full_name, User.school_id)
        .all()
    )
    return [
        {
            **_person(teacher),
            "has_subject_permission": teacher.school_id in permitted if subject_id else None,
        }
        for teacher in teachers
    ]


@router.get("/classes/{class_id}")
def get_class_detail(
    class_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _management_admin(db, current_user)
    course_class = _class_or_404(db, class_id)
    students = (
        db.query(User)
        .join(StudentClass, StudentClass.student_id == User.school_id)
        .filter(StudentClass.class_id == class_id, User.role == UserRole.student)
        .order_by(User.full_name, User.school_id)
        .all()
    )
    return {
        **_serialize_class(course_class, len(students)),
        "teacher_has_subject_permission": (
            course_class.teacher_id in _active_subject_teacher_ids(db, course_class.subject_id)
        ),
        "students": [_person(student) for student in students],
    }


@router.get("/classes/{class_id}/available-students")
def list_available_students(
    class_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _management_admin(db, current_user)
    course_class = _class_or_404(db, class_id)
    enrolled = [
        row[0] for row in db.query(StudentClass.student_id).filter(StudentClass.class_id == class_id).all()
    ]
    query = db.query(User).filter(User.role == UserRole.student, User.deleted_at.is_(None))
    if enrolled:
        query = query.filter(~User.school_id.in_(enrolled))
    taken = _subject_enrolment_map(db, course_class.subject_id, class_id)
    return [
        {
            **_person(student),
            "conflict_class_name": (
                taken[student.school_id].class_name if student.school_id in taken else None
            ),
        }
        for student in query.order_by(User.full_name, User.school_id).all()
    ]


@router.patch("/classes/{class_id}/teacher")
def change_class_teacher(
    class_id: int,
    payload: ClassTeacherPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _management_admin(db, current_user)
        course_class = _class_or_404(db, class_id)
        teacher = _class_teacher(db, payload.teacher_school_id)
        course_class.teacher_id = teacher.school_id
        granted = _ensure_subject_permission(db, teacher.school_id, course_class.subject_id, admin)
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="CLASS_TEACHER_UPDATED", entity_type="class", entity_id=class_id,
            metadata={"teacher_school_id": teacher.school_id, "subject_id": course_class.subject_id},
        )
        if granted:
            record_audit(
                db, actor_school_id=admin.school_id, actor_role=admin.role,
                action="TEACHER_PERMISSION_UPDATED", entity_type="teacher_permission", entity_id=teacher.school_id,
                metadata={"subject_id": course_class.subject_id, "is_active": True},
            )
            enqueue_outbox_event(
                db, event_type="analytics.permission_updated", aggregate_type="teacher_permission",
                aggregate_id=teacher.school_id, metadata={"active_subject_count": len(_active_subject_teacher_ids(db, course_class.subject_id))},
            )
        db.commit()
        if granted:
            deliver_invalidation(admin_permission_updated(teacher.school_id))
        db.refresh(course_class)
        count = db.query(StudentClass).filter(StudentClass.class_id == class_id).count()
        return {**_serialize_class(course_class, count), "granted_subject_permission": granted}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The class teacher could not be updated") from exc
    except Exception:
        db.rollback()
        raise


@router.post("/classes/{class_id}/students", status_code=status.HTTP_201_CREATED)
def add_class_students(
    class_id: int,
    payload: ClassStudentsPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        _management_admin(db, current_user)
        course_class = _class_or_404(db, class_id)
        _lock_subject_classes(db, course_class.subject_id)
        requested = [school_id.strip() for school_id in payload.student_ids if school_id.strip()]
        if not requested:
            raise HTTPException(status_code=400, detail="At least one student is required")
        found = {
            user.school_id
            for user in db.query(User).filter(
                User.school_id.in_(requested),
                User.role == UserRole.student,
                User.deleted_at.is_(None),
            )
        }
        missing = sorted(set(requested) - found)
        if missing:
            raise HTTPException(
                status_code=422,
                detail={"message": "One or more students were not found", "student_ids": missing},
            )
        already = {
            row[0]
            for row in db.query(StudentClass.student_id)
            .filter(StudentClass.class_id == class_id, StudentClass.student_id.in_(requested))
            .all()
        }
        added = sorted(found - already)
        # One class per subject per student. Checked inside the request rather
        # than trusting the dialog, which only greys the offenders out.
        taken = _subject_enrolment_map(db, course_class.subject_id, class_id)
        clashes = [(school_id, taken[school_id]) for school_id in added if school_id in taken]
        if clashes:
            names = {
                user.school_id: user.full_name
                for user in db.query(User).filter(User.school_id.in_([item[0] for item in clashes]))
            }
            listed = ", ".join(
                f"{names.get(school_id, school_id)} (already in {other.class_name})"
                for school_id, other in clashes
            )
            raise HTTPException(
                status_code=409,
                detail=(
                    f"A student can only attend one {course_class.subject_id} class. "
                    f"Remove them from the other class first: {listed}."
                ),
            )
        db.add_all(StudentClass(class_id=class_id, student_id=school_id) for school_id in added)
        record_audit(
            db, actor_school_id=current_user["school_id"], actor_role=current_user.get("role"),
            action="CLASS_ROSTER_UPDATED", entity_type="class", entity_id=class_id,
            metadata={"added_count": len(added), "removed_count": 0},
        )
        db.commit()
        deliver_invalidation(admin_enrollment_updated(class_id))
        return {"added_count": len(added), "skipped_count": len(already), "student_ids": added}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="One or more students are already enrolled") from exc
    except Exception:
        db.rollback()
        raise


@router.delete("/classes/{class_id}/students/{student_school_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_class_student(
    class_id: int,
    student_school_id: str,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Drops class membership only; existing exam assignments are left untouched."""
    del role_check
    try:
        _management_admin(db, current_user)
        course_class = _class_or_404(db, class_id)
        _lock_subject_classes(db, course_class.subject_id)
        membership = (
            db.query(StudentClass)
            .filter(StudentClass.class_id == class_id, StudentClass.student_id == student_school_id)
            .first()
        )
        if not membership:
            raise HTTPException(status_code=404, detail="Student is not enrolled in this class")
        db.delete(membership)
        record_audit(
            db, actor_school_id=current_user["school_id"], actor_role=current_user.get("role"),
            action="CLASS_ROSTER_UPDATED", entity_type="class", entity_id=class_id,
            metadata={"added_count": 0, "removed_count": 1},
        )
        db.commit()
        deliver_invalidation(admin_enrollment_updated(class_id))
        return None
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


class CreateClassPayload(BaseModel):
    class_name: str = Field(min_length=1, max_length=100)
    subject_id: str = Field(min_length=1, max_length=20)
    teacher_school_id: str = Field(min_length=1, max_length=30)


class RenameClassPayload(BaseModel):
    class_name: str = Field(min_length=1, max_length=100)


def _reject_duplicate_class_name(db: Session, subject_id: str, class_name: str, exclude_id: int | None = None) -> None:
    """The schema has no unique key here, so guard against confusing same-name siblings."""
    query = db.query(CourseClass).filter(
        CourseClass.subject_id == subject_id,
        func.lower(CourseClass.class_name) == class_name.lower(),
    )
    if exclude_id is not None:
        query = query.filter(CourseClass.class_id != exclude_id)
    if query.first():
        raise HTTPException(status_code=409, detail="A class with this name already exists for the subject")


@router.post("/classes", status_code=status.HTTP_201_CREATED)
def create_class(
    payload: CreateClassPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        admin = _management_admin(db, current_user)
        class_name = payload.class_name.strip()
        if not class_name:
            raise HTTPException(status_code=400, detail="Class name is required")
        _permission_subject(db, payload.subject_id)
        teacher = _class_teacher(db, payload.teacher_school_id)
        _reject_duplicate_class_name(db, payload.subject_id, class_name)
        course_class = CourseClass(
            class_name=class_name,
            subject_id=payload.subject_id,
            teacher_id=teacher.school_id,
        )
        db.add(course_class)
        granted = _ensure_subject_permission(db, teacher.school_id, payload.subject_id, admin)
        db.flush()
        record_audit(
            db, actor_school_id=admin.school_id, actor_role=admin.role,
            action="CLASS_CREATED", entity_type="class", entity_id=course_class.class_id,
            metadata={"subject_id": payload.subject_id, "teacher_school_id": teacher.school_id},
        )
        if granted:
            record_audit(
                db, actor_school_id=admin.school_id, actor_role=admin.role,
                action="TEACHER_PERMISSION_UPDATED", entity_type="teacher_permission", entity_id=teacher.school_id,
                metadata={"subject_id": payload.subject_id, "is_active": True},
            )
            enqueue_outbox_event(
                db, event_type="analytics.permission_updated", aggregate_type="teacher_permission",
                aggregate_id=teacher.school_id, metadata={"active_subject_count": len(_active_subject_teacher_ids(db, payload.subject_id))},
            )
        db.commit()
        if granted:
            deliver_invalidation(admin_permission_updated(teacher.school_id))
        db.refresh(course_class)
        return {**_serialize_class(course_class, 0), "granted_subject_permission": granted}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The class could not be created") from exc
    except Exception:
        db.rollback()
        raise


@router.patch("/classes/{class_id}")
def rename_class(
    class_id: int,
    payload: RenameClassPayload,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Only the name is editable: moving a class to another subject would strand
    the roster against exams already assigned under the original subject."""
    del role_check
    try:
        _management_admin(db, current_user)
        course_class = _class_or_404(db, class_id)
        class_name = payload.class_name.strip()
        if not class_name:
            raise HTTPException(status_code=400, detail="Class name is required")
        _reject_duplicate_class_name(db, course_class.subject_id, class_name, exclude_id=class_id)
        course_class.class_name = class_name
        record_audit(
            db, actor_school_id=current_user["school_id"], actor_role=current_user.get("role"),
            action="CLASS_RENAMED", entity_type="class", entity_id=class_id, metadata={"subject_id": course_class.subject_id},
        )
        db.commit()
        db.refresh(course_class)
        count = db.query(StudentClass).filter(StudentClass.class_id == class_id).count()
        return _serialize_class(course_class, count)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The class name is already in use for this subject") from exc
    except Exception:
        db.rollback()
        raise


@router.delete("/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(
    class_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    """Removes the class and its memberships. Exam assignments already made from
    this roster live in student_exam and are deliberately left untouched."""
    del role_check
    try:
        _management_admin(db, current_user)
        course_class = _class_or_404(db, class_id)
        db.query(StudentClass).filter(StudentClass.class_id == class_id).delete(synchronize_session=False)
        db.query(CourseClass).filter(CourseClass.class_id == class_id).delete(synchronize_session=False)
        record_audit(
            db, actor_school_id=current_user["school_id"], actor_role=current_user.get("role"),
            action="CLASS_DELETED", entity_type="class", entity_id=class_id, metadata={"subject_id": course_class.subject_id},
        )
        db.commit()
        return None
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The class is still referenced and cannot be deleted") from exc


def _admin_report_job(db: Session, job_id: int) -> BackgroundJob:
    job = db.get(BackgroundJob, job_id)
    metadata = job.result_metadata if job and isinstance(job.result_metadata, dict) else {}
    job_type = job.job_type.value if job and hasattr(job.job_type, "value") else (str(job.job_type) if job else "")
    if not job or job_type != BackgroundJobType.report_export.value or metadata.get("report_type") != REPORT_TYPE_EXAM_RESULTS:
        raise HTTPException(status_code=404, detail="Report job not found")
    return job


@router.get("/reports/report-jobs/{job_id}")
def get_admin_exam_results_report_job(
    job_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    return report_job_summary(_admin_report_job(db, job_id))


@router.get("/reports/report-jobs/{job_id}/download")
def download_admin_exam_results_report_job(
    job_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(ADMIN_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _admin(db, current_user["school_id"])
    job = _admin_report_job(db, job_id)
    job_status = job.status.value if hasattr(job.status, "value") else str(job.status)
    if job_status != BackgroundJobStatus.completed.value:
        raise HTTPException(status_code=409, detail="Report job is not complete")
    try:
        artifact = report_artifact_bytes(job)
    except FileNotFoundError:
        raise HTTPException(status_code=409, detail="Report artifact is not available")
    return Response(
        artifact,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="exam_results_{job.job_id}.xlsx"'},
    )
