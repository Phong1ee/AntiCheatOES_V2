"""Teacher-owned uploads retained for a later Admin bulk import review."""

from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import tempfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from src.a_db_config import BulkDataRequest, BulkDataRequestStatus, BulkDataRequestType, Subject, User, UserRole
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token
from src.service import bulk_data_request_storage as storage
from src.service.audit_service import record_audit
from src.service.question_bank_import_parser import QuestionBankParseError, parse_question_bank_document
from src.service.teacher_subject_service import require_active_subject_assignment
from src.service.user_import_service import UserImportParseError, parse_user_import_xlsx


router = APIRouter(prefix="/bulk-data-requests")

MAX_FILE_SIZE = 5 * 1024 * 1024
_QUESTION_SUFFIXES = {".docx", ".pdf"}
_USER_SUFFIXES = {".xlsx"}
_SAFE_RESULT_KEYS = {
    "total_rows",
    "processed_rows",
    "success_rows",
    "failed_rows",
    "imported_count",
    "error_count",
    "message",
}


def _value(item: object | None) -> str | None:
    return item.value if hasattr(item, "value") else (str(item) if item is not None else None)


def _teacher(db: Session, school_id: str) -> User:
    teacher = db.query(User).filter(User.school_id == school_id).first()
    if not teacher or _value(teacher.role) != UserRole.teacher.value:
        raise HTTPException(status_code=403, detail="Teacher role is required")
    if teacher.is_locked or teacher.deleted_at is not None:
        raise HTTPException(status_code=403, detail="Teacher account is unavailable")
    return teacher


def _request_type(value: str) -> BulkDataRequestType:
    try:
        return BulkDataRequestType(value.strip().upper())
    except (AttributeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="request_type must be QUESTION_BANK or USER_IMPORT") from exc


def _filename_and_suffix(filename: str | None) -> tuple[str, str]:
    safe_name = Path(filename or "").name
    if not safe_name or len(safe_name) > 255:
        raise HTTPException(status_code=422, detail="A filename up to 255 characters is required")
    return safe_name, Path(safe_name).suffix.casefold()


def _parse_question_content(content: bytes, suffix: str):
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary_file:
            temporary_file.write(content)
            temporary_path = Path(temporary_file.name)
        return parse_question_bank_document(temporary_path)
    except QuestionBankParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _validate_upload(
    request_type: BulkDataRequestType,
    subject_id: str | None,
    filename: str,
    suffix: str,
    content: bytes,
    db: Session,
    teacher: User,
) -> None:
    if request_type == BulkDataRequestType.question_bank:
        if suffix not in _QUESTION_SUFFIXES:
            raise HTTPException(status_code=422, detail="QUESTION_BANK files must be .docx or text-based .pdf")
        if not subject_id:
            raise HTTPException(status_code=422, detail="subject_id is required for QUESTION_BANK requests")
        require_active_subject_assignment(db, teacher.school_id, subject_id)
        parsed = _parse_question_content(content, suffix)
        if parsed.subject.subject_id != subject_id:
            raise HTTPException(status_code=422, detail="Uploaded Question Bank Subject ID must match subject_id")
        return

    if subject_id:
        raise HTTPException(status_code=422, detail="subject_id must be empty for USER_IMPORT requests")
    if suffix not in _USER_SUFFIXES:
        raise HTTPException(status_code=422, detail="USER_IMPORT files must be .xlsx")
    try:
        parse_user_import_xlsx(content)
    except UserImportParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _safe_result_metadata(metadata: object) -> dict | None:
    if not isinstance(metadata, dict):
        return None
    return {
        key: value
        for key, value in metadata.items()
        if key in _SAFE_RESULT_KEYS and isinstance(value, (str, int, float, bool, type(None)))
    } or None


def _serialize_request(item: BulkDataRequest, db: Session) -> dict:
    subject = db.get(Subject, item.subject_id) if item.subject_id else None
    return {
        "request_id": item.request_id,
        "request_type": _value(item.request_type),
        "status": _value(item.status),
        "subject": (
            {"subject_id": subject.subject_id, "subject_name": subject.subject_name}
            if subject else None
        ),
        "original_filename": item.original_filename,
        "file_size": item.file_size,
        "teacher_note": item.teacher_note,
        "admin_note": item.admin_note,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "processed_at": item.processed_at.isoformat() if item.processed_at else None,
        "result_metadata": _safe_result_metadata(item.result_metadata),
    }


def create_bulk_data_request(
    db: Session,
    *,
    current_user: dict,
    request_type: str,
    subject_id: str | None,
    teacher_note: str | None,
    filename: str | None,
    content: bytes,
) -> BulkDataRequest:
    """Validate and atomically record an upload; parsing never creates import data."""
    teacher = _teacher(db, current_user["school_id"])
    parsed_type = _request_type(request_type)
    safe_filename, suffix = _filename_and_suffix(filename)
    subject_id = subject_id.strip() if subject_id else None
    note = teacher_note.strip() if teacher_note else None
    if subject_id and len(subject_id) > 20:
        raise HTTPException(status_code=422, detail="subject_id must be at most 20 characters")
    if note and len(note) > 500:
        raise HTTPException(status_code=422, detail="teacher_note must be at most 500 characters")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Uploaded file must not exceed 5 MB")

    _validate_upload(parsed_type, subject_id, safe_filename, suffix, content, db, teacher)
    stored_file_key: str | None = None
    committed = False
    try:
        stored_file_key = storage.save(content, safe_filename)
        request = BulkDataRequest(
            request_type=parsed_type,
            status=BulkDataRequestStatus.pending,
            requested_by=teacher.school_id,
            subject_id=subject_id,
            original_filename=safe_filename,
            stored_file_key=stored_file_key,
            file_size=len(content),
            sha256=sha256(content).hexdigest(),
            teacher_note=note,
        )
        db.add(request)
        db.flush()
        record_audit(
            db,
            actor_school_id=teacher.school_id,
            actor_role=teacher.role,
            action="BULK_DATA_REQUEST_SUBMITTED",
            entity_type="bulk_data_request",
            entity_id=request.request_id,
            metadata={"request_type": parsed_type.value, "subject_id": subject_id, "file_size": len(content)},
        )
        db.commit()
        committed = True
        db.refresh(request)
        return request
    except Exception as exc:
        db.rollback()
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Bulk data request could not be saved") from exc
    finally:
        # The DB transaction is authoritative. Remove only a newly stored file after failure.
        if stored_file_key is not None and not committed:
            try:
                storage.delete(stored_file_key)
            except Exception:
                pass


def get_own_bulk_data_request(db: Session, request_id: int, current_user: dict) -> BulkDataRequest:
    _teacher(db, current_user["school_id"])
    item = (
        db.query(BulkDataRequest)
        .filter(BulkDataRequest.request_id == request_id, BulkDataRequest.requested_by == current_user["school_id"])
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Bulk data request not found")
    return item


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_bulk_data_request(
    request_type: str = Form(...),
    subject_id: str | None = Form(None),
    teacher_note: str | None = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    content = await file.read(MAX_FILE_SIZE + 1)
    item = await run_in_threadpool(
        create_bulk_data_request,
        db,
        current_user=current_user,
        request_type=request_type,
        subject_id=subject_id,
        teacher_note=teacher_note,
        filename=file.filename,
        content=content,
    )
    return _serialize_request(item, db)


@router.get("")
def list_bulk_data_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _teacher(db, current_user["school_id"])
    query = db.query(BulkDataRequest).filter(BulkDataRequest.requested_by == current_user["school_id"])
    total = query.with_entities(func.count(BulkDataRequest.request_id)).scalar() or 0
    items = query.order_by(BulkDataRequest.created_at.desc(), BulkDataRequest.request_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_serialize_request(item, db) for item in items], "page": page, "page_size": page_size, "total": total}


@router.get("/{request_id}/download")
def download_bulk_data_request(
    request_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    item = get_own_bulk_data_request(db, request_id, current_user)
    if not item.stored_file_key or not storage.exists(item.stored_file_key):
        raise HTTPException(status_code=410, detail="The uploaded file is no longer available")
    return Response(
        storage.read(item.stored_file_key), media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{item.original_filename}"'},
    )


@router.get("/{request_id}")
def get_bulk_data_request(
    request_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    return _serialize_request(get_own_bulk_data_request(db, request_id, current_user), db)
