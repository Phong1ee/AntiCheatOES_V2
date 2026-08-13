"""Concrete, idempotent consumer for staged background bulk imports."""

from src.a_db_config import BackgroundJob, BackgroundJobStatus, BackgroundJobType
from src.service.background_job_service import complete_job, fail_job, mark_job_running, update_job_progress
from src.service.import_job_service import delete_staged_source, import_batch_size, source_path
from src.service.rabbitmq_worker import consume
from src.service.user_import_service import UserImportParseError, parse_user_import_xlsx
from src.service.question_bank_import_parser import QuestionBankParseError, parse_question_bank_document


def _user_import_error(row) -> dict:
    return {"row": row.row_number, "errors": list(row.errors)}


def _dispatch_user_import(job: BackgroundJob, source, suffix: str, db) -> None:
    """Commit each user-import batch and persist real progress after it commits."""
    from src.route.adminRoute import build_user_import_preview, import_users_from_rows
    from src.service.user_import_service import parse_user_import_xlsx

    rows = parse_user_import_xlsx(source.read_bytes())
    total = len(rows)
    if job.total_rows != total:
        job.total_rows = total
    start = min(job.processed_rows, total)
    succeeded = job.success_rows
    failed = job.failed_rows
    errors = list((job.error_metadata or {}).get("row_errors", []))
    batch_size = import_batch_size()

    for offset in range(start, total, batch_size):
        batch = rows[offset:offset + batch_size]
        preview = build_user_import_preview(batch, db)
        invalid_numbers = {item["row_number"] for item in preview["rows"] if item["status"] == "invalid"}
        valid_rows = [row for row in batch if row.row_number not in invalid_numbers]
        batch_errors = [_user_import_error(row) for row in batch if row.row_number in invalid_numbers]
        if valid_rows:
            try:
                # The whole valid subset is one DB transaction. A failed subset
                # rolls back without poisoning the next durable batch.
                import_users_from_rows(valid_rows, db, commit=False)
                succeeded += len(valid_rows)
            except Exception as exc:
                db.rollback()
                batch_errors.extend({"row": row.row_number, "errors": [str(getattr(exc, "detail", exc))]} for row in valid_rows)
        failed += len(batch_errors)
        errors.extend(batch_errors)
        processed = offset + len(batch)
        update_job_progress(
            db,
            job.job_id,
            processed_rows=processed,
            success_rows=succeeded,
            failed_rows=failed,
            error_metadata={"row_errors": errors[:200]},
        )
        # Progress only moves forward after user mutations have committed.
        db.commit()

    metadata = job.result_metadata if isinstance(job.result_metadata, dict) else {}
    complete_job(
        db,
        job.job_id,
        processed_rows=total,
        success_rows=succeeded,
        failed_rows=failed,
        result_metadata={**metadata, "batch_size": batch_size, "row_error_count": len(errors)},
    )
    db.commit()
    delete_staged_source(job.job_id, suffix)


def _question_batch(parsed, questions):
    """Keep the parser's validated subject while passing one durable batch."""
    from src.service.question_bank_import_parser import ParsedQuestionBank

    return ParsedQuestionBank(subject=parsed.subject, questions=questions)


def _dispatch_question_import(job: BackgroundJob, source, suffix: str, db) -> None:
    """Persist Question Bank imports in committed, restart-safe batches."""
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

    start = min(job.processed_rows, total)
    succeeded = job.success_rows
    skipped = int(metadata.get("duplicate_skipped_count", 0))
    batch_size = import_batch_size()

    for offset in range(start, total, batch_size):
        batch = parsed.questions[offset:offset + batch_size]
        result = import_question_bank_data(
            _question_batch(parsed, batch), selected_subject_id, current_user, db, commit=False
        )
        succeeded += int(result["imported_count"])
        skipped += int(result["duplicate_skipped_count"])
        processed = offset + len(batch)
        update_job_progress(
            db,
            job.job_id,
            processed_rows=processed,
            success_rows=succeeded,
            failed_rows=0,
        )
        # Question/taxonomy rows and their progress become durable together.
        db.commit()

    completed_metadata = {
        "source_filename": metadata.get("source_filename"),
        "source_suffix": suffix,
        "source_sha256": metadata.get("source_sha256"),
        "duplicate_skipped_count": skipped,
        "batch_size": batch_size,
    }
    complete_job(
        db,
        job.job_id,
        processed_rows=total,
        success_rows=succeeded,
        failed_rows=0,
        result_metadata=completed_metadata,
    )
    db.commit()
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
        db.info.setdefault("after_commit", []).append(lambda: delete_staged_source(job.job_id, suffix))
        return
    except Exception as exc:
        # User-visible validation failures are terminal; unexpected failures roll
        # back so the shared worker framework can retry them.
        if hasattr(exc, "status_code") and 400 <= exc.status_code < 500:
            fail_job(db, job.job_id, error=str(getattr(exc, "detail", exc)), error_metadata={"kind": "validation"})
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


def run_forever() -> None:
    consume("import.queue", handle_import_requested, on_retry_exhausted=_mark_import_failed)


if __name__ == "__main__":
    run_forever()
