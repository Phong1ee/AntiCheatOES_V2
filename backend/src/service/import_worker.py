"""Concrete, idempotent consumer for staged background bulk imports."""

from datetime import datetime

from src.a_db_config import BackgroundJob, BackgroundJobStatus, BackgroundJobType, BulkDataRequest, BulkDataRequestStatus, UserRole
from src.service.background_job_service import complete_job, fail_job, mark_job_running, update_job_progress
from src.service.import_job_service import delete_staged_source, import_batch_size, source_path
from src.service.rabbitmq_worker import consume
from src.service.user_import_service import UserImportParseError, parse_user_import_xlsx
from src.service.question_bank_import_parser import QuestionBankParseError, parse_question_bank_document
from src.service import bulk_data_request_storage as bulk_request_storage
from src.service.audit_service import record_audit


def _propagate_bulk_request_status(job: BackgroundJob, db) -> None:
    """Mirror terminal job state to its originating Teacher request when present."""
    metadata = job.result_metadata if isinstance(job.result_metadata, dict) else {}
    request_id = metadata.get("bulk_data_request_id")
    if not isinstance(request_id, int):
        return
    request = db.get(BulkDataRequest, request_id, with_for_update=True)
    if not request or request.status != BulkDataRequestStatus.processing:
        return
    if job.status == BackgroundJobStatus.completed:
        request.status = BulkDataRequestStatus.imported
        request.processed_at = datetime.now()
        request.result_metadata = {
            "imported_count": job.success_rows,
            "failed_rows": job.failed_rows,
            **{
                key: value for key, value in metadata.items()
                if key in {"imported_count", "duplicate_skipped_count", "success_rows", "failed_rows", "role_counts"}
            },
        }
        record_audit(
            db,
            actor_school_id=job.requested_by,
            actor_role=UserRole.admin,
            action="BULK_DATA_REQUEST_IMPORTED",
            entity_type="bulk_data_request",
            entity_id=request.request_id,
            metadata={"job_id": job.job_id, "request_type": request.request_type.value, "imported_count": job.success_rows},
            outcome="SUCCESS",
        )
    elif job.status == BackgroundJobStatus.failed:
        request.status = BulkDataRequestStatus.failed
        request.processed_at = datetime.now()
        request.result_metadata = {"message": (job.last_error or "Background import failed")[:500]}
        record_audit(
            db,
            actor_school_id=job.requested_by,
            actor_role=UserRole.admin,
            action="BULK_DATA_REQUEST_FAILED",
            entity_type="bulk_data_request",
            entity_id=request.request_id,
            metadata={"job_id": job.job_id, "request_type": request.request_type.value},
            outcome="FAILED",
        )


def _record_direct_import_terminal(job: BackgroundJob, db) -> None:
    """Audit only direct Admin jobs; bulk requests have their own lifecycle event."""
    metadata = job.result_metadata if isinstance(job.result_metadata, dict) else {}
    if isinstance(metadata.get("bulk_data_request_id"), int):
        return
    action_prefix = "QUESTION_IMPORT" if job.job_type == BackgroundJobType.question_import else "USER_IMPORT"
    outcome = "SUCCESS" if job.status == BackgroundJobStatus.completed else "FAILED"
    record_audit(
        db, actor_school_id=job.requested_by, actor_role=UserRole.admin,
        action=f"{action_prefix}_{'COMPLETED' if outcome == 'SUCCESS' else 'FAILED'}",
        entity_type="background_job", entity_id=job.job_id, outcome=outcome,
        metadata={"job_id": job.job_id, "success_rows": job.success_rows, "failed_rows": job.failed_rows, "subject_id": metadata.get("subject_id")},
    )


def _cleanup_completed_bulk_request(job: BackgroundJob, db) -> None:
    """Remove the original Teacher source only after the imported state is committed."""
    metadata = job.result_metadata if isinstance(job.result_metadata, dict) else {}
    request_id = metadata.get("bulk_data_request_id")
    if not isinstance(request_id, int):
        return
    request = db.get(BulkDataRequest, request_id, with_for_update=True)
    if not request or request.status != BulkDataRequestStatus.imported or not request.stored_file_key:
        return
    key = request.stored_file_key
    try:
        if not bulk_request_storage.delete(key):
            return
    except OSError:
        return
    request.stored_file_key = None
    db.commit()


def _user_import_error(row) -> dict:
    return {"row": row.row_number, "errors": list(row.errors)}


def _dispatch_user_import(job: BackgroundJob, source, suffix: str, db) -> None:
    """Import a Teacher request atomically; a failed request creates no users."""
    from src.route.adminRoute import build_user_import_preview, import_users_from_rows
    from src.service.user_import_service import parse_user_import_xlsx

    rows = parse_user_import_xlsx(source.read_bytes())
    total = len(rows)
    preview = build_user_import_preview(rows, db)
    if preview["error_count"]:
        raise UserImportParseError("Import validation failed")
    result = import_users_from_rows(rows, db, commit=False)

    metadata = job.result_metadata if isinstance(job.result_metadata, dict) else {}
    complete_job(
        db,
        job.job_id,
        processed_rows=total,
        success_rows=int(result["imported_count"]),
        failed_rows=0,
        result_metadata={**metadata, "imported_count": int(result["imported_count"])},
    )
    _record_direct_import_terminal(job, db)
    db.commit()
    _propagate_bulk_request_status(job, db)
    db.commit()
    _cleanup_completed_bulk_request(job, db)
    delete_staged_source(job.job_id, suffix)


def _question_batch(parsed, questions):
    """Keep the parser's validated subject while passing one durable batch."""
    from src.service.question_bank_import_parser import ParsedQuestionBank

    return ParsedQuestionBank(subject=parsed.subject, questions=questions)


def _dispatch_question_import(job: BackgroundJob, source, suffix: str, db) -> None:
    """Persist a Teacher Question Bank request in one transaction."""
    from src.a_db_config import Subject
    from src.route.adminRoute import import_new_subject_question_bank_data, import_question_bank_data

    metadata = job.result_metadata if isinstance(job.result_metadata, dict) else {}
    parsed = parse_question_bank_document(source)
    total = len(parsed.questions)
    if job.total_rows != total:
        job.total_rows = total

    current_user = {"school_id": job.requested_by, "role": "admin"}
    selected_subject_id = str(metadata.get("subject_id") or "").strip()
    if metadata.get("new_subject"):
        selected_subject_id = parsed.subject.subject_id
        # A retry after the subject-creation commit owns this subject through
        # the job's immutable source hash and requested_by identity.
        if not db.get(Subject, selected_subject_id):
            import_new_subject_question_bank_data(
                _question_batch(parsed, []), True, current_user, db, commit=False
            )
            db.commit()
    elif not selected_subject_id:
        raise ValueError("Question import job is missing its subject")

    result = import_question_bank_data(
        parsed, selected_subject_id, current_user, db,
        creator_school_id=metadata.get("question_creator_school_id") if isinstance(metadata.get("question_creator_school_id"), str) else None,
        commit=False,
    )

    completed_metadata = {
        **metadata,
        "duplicate_skipped_count": int(result["duplicate_skipped_count"]),
    }
    complete_job(
        db,
        job.job_id,
        processed_rows=total,
        success_rows=int(result["imported_count"]),
        failed_rows=0,
        result_metadata=completed_metadata,
    )
    _record_direct_import_terminal(job, db)
    db.commit()
    _propagate_bulk_request_status(job, db)
    db.commit()
    _cleanup_completed_bulk_request(job, db)
    delete_staged_source(job.job_id, suffix)


def dispatch_import_job(job: BackgroundJob, db) -> None:
    """Execute one staged import without placing the whole file in one transaction."""
    metadata = job.result_metadata if isinstance(job.result_metadata, dict) else {}
    suffix = metadata.get("source_suffix")
    if not isinstance(suffix, str):
        raise ValueError("Import job is missing its staged source type")
    source = source_path(job.job_id, suffix)
    if not source.is_file():
        raise FileNotFoundError("Staged import source is not available")

    mark_job_running(db, job.job_id)
    db.commit()
    try:
        if job.job_type == BackgroundJobType.user_import:
            _dispatch_user_import(job, source, suffix, db)
            return
        if job.job_type == BackgroundJobType.question_import:
            _dispatch_question_import(job, source, suffix, db)
            return
        raise ValueError("Unsupported import background job type")
    except (UserImportParseError, QuestionBankParseError) as exc:
        fail_job(db, job.job_id, error=str(exc), error_metadata={"kind": "validation"})
        _propagate_bulk_request_status(job, db)
        _record_direct_import_terminal(job, db)
        db.info.setdefault("after_commit", []).append(lambda: delete_staged_source(job.job_id, suffix))
        return
    except Exception as exc:
        # User-visible validation failures are terminal; unexpected failures roll
        # back so the shared worker framework can retry them.
        if hasattr(exc, "status_code") and 400 <= exc.status_code < 500:
            fail_job(db, job.job_id, error=str(getattr(exc, "detail", exc)), error_metadata={"kind": "validation"})
            _propagate_bulk_request_status(job, db)
            _record_direct_import_terminal(job, db)
            db.info.setdefault("after_commit", []).append(lambda: delete_staged_source(job.job_id, suffix))
            return
        raise



def handle_import_requested(envelope: dict, db) -> None:
    """Resolve one job by ID and route only recognized import job types."""
    if envelope.get("event_type") != "import.requested":
        raise ValueError("import.queue accepts import.requested events only")
    try:
        job_id = int(envelope["aggregate_id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("import.requested requires a numeric background job aggregate_id") from exc
    job = db.get(BackgroundJob, job_id, with_for_update=True)
    if not job:
        raise ValueError("Import background job not found")
    if job.status in {BackgroundJobStatus.completed, BackgroundJobStatus.failed}:
        return
    dispatch_import_job(job, db)


def _mark_import_failed(envelope: dict, error: Exception, db) -> None:
    """Make retry exhaustion visible instead of falsely completing an import."""
    try:
        job_id = int(envelope.get("aggregate_id"))
    except (TypeError, ValueError):
        return
    job = db.get(BackgroundJob, job_id, with_for_update=True)
    if job and job.status in {BackgroundJobStatus.pending, BackgroundJobStatus.running}:
        fail_job(db, job_id, error=str(error), error_metadata={"event_type": envelope.get("event_type")})
        _propagate_bulk_request_status(job, db)
        _record_direct_import_terminal(job, db)


def run_forever() -> None:
    consume("import.queue", handle_import_requested, on_retry_exhausted=_mark_import_failed)


if __name__ == "__main__":
    run_forever()
