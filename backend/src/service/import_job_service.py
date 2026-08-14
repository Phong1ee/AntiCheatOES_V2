"""Durable source staging and job creation for bounded background imports."""

from __future__ import annotations

from contextlib import contextmanager
from hashlib import sha256
import os
from pathlib import Path
import tempfile

from sqlalchemy.orm import Session

from src.a_db_config import BackgroundJob, BackgroundJobType
from src.service.background_job_service import get_or_create_job
from src.service.outbox_publisher import enqueue_outbox_event
from src.service.object_storage import storage_for


DEFAULT_BACKGROUND_THRESHOLD = 100
DEFAULT_IMPORT_BATCH_SIZE = 100
_ALLOWED_SUFFIXES = {".xlsx", ".docx", ".pdf"}


def background_import_threshold() -> int:
    """Return the operator-configurable row threshold with a safe default."""
    try:
        return max(1, int(os.getenv("IMPORT_BACKGROUND_THRESHOLD", str(DEFAULT_BACKGROUND_THRESHOLD))))
    except ValueError:
        return DEFAULT_BACKGROUND_THRESHOLD


def should_background_import(total_rows: int) -> bool:
    return total_rows >= background_import_threshold()


def import_batch_size() -> int:
    """Return the bounded durable-work batch size used by import workers."""
    try:
        return min(200, max(50, int(os.getenv("IMPORT_BATCH_SIZE", str(DEFAULT_IMPORT_BATCH_SIZE)))))
    except ValueError:
        return DEFAULT_IMPORT_BATCH_SIZE


def _staging_directory() -> Path:
    configured = os.getenv("IMPORT_STAGING_DIR", "generated_imports").strip()
    directory = Path(configured)
    if not directory.is_absolute():
        directory = Path(__file__).resolve().parents[2] / directory
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _safe_suffix(filename: str | None) -> str:
    suffix = Path(filename or "").suffix.casefold()
    if suffix not in _ALLOWED_SUFFIXES:
        raise ValueError("Unsupported staged import file type")
    return suffix


def source_path(job_id: int, suffix: str) -> Path:
    """Resolve only a deterministic internal file path from trusted job metadata."""
    if suffix not in _ALLOWED_SUFFIXES:
        raise ValueError("Unsupported staged import file type")
    return _storage().local_path(source_key(job_id, suffix))


def source_key(job_id: int, suffix: str) -> str:
    if suffix not in _ALLOWED_SUFFIXES:
        raise ValueError("Unsupported staged import file type")
    return f"import_job_{job_id}{suffix}"


def _storage():
    return storage_for("imports", _staging_directory())


def _stage_source(job_id: int, suffix: str, content: bytes) -> Path:
    key = source_key(job_id, suffix)
    _storage().put(key, content)
    # Callers do not persist this value; object keys remain the only durable reference.
    return Path(key)


def delete_staged_source(job_id: int, suffix: str) -> None:
    _storage().delete(source_key(job_id, suffix))


@contextmanager
def materialized_source(job_id: int, suffix: str, key: str | None = None, expected_sha256: str | None = None):
    """Make a private object available to path-based parsers and always remove it."""
    data = _storage().get(key or source_key(job_id, suffix))
    if expected_sha256 and sha256(data).hexdigest() != expected_sha256.casefold():
        raise ValueError("Staged import source failed its integrity check")
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="oes-import-", suffix=suffix, delete=False) as handle:
            handle.write(data)
            temporary_path = Path(handle.name)
        yield temporary_path
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def queue_import_job(
    db: Session,
    *,
    job_type: BackgroundJobType,
    requested_by: str,
    filename: str | None,
    content: bytes,
    total_rows: int,
    scope: str,
    metadata: dict | None = None,
) -> tuple[BackgroundJob, bool]:
    """Stage a source and atomically create its job plus compact outbox event."""
    if job_type not in {BackgroundJobType.user_import, BackgroundJobType.question_import}:
        raise ValueError("Only import jobs can be queued")
    suffix = _safe_suffix(filename)
    content_hash = sha256(content).hexdigest()
    job, duplicate = get_or_create_job(
        db,
        job_type=job_type,
        requested_by=requested_by,
        business_key=f"{job_type.value}:sha256:{content_hash}:scope:{scope}",
        total_rows=total_rows,
        result_metadata={
            "source_filename": Path(filename or f"import{suffix}").name[:255],
            "source_suffix": suffix,
            "source_sha256": content_hash,
                **(metadata or {}),
            },
        )
    if duplicate:
        return job, True

    try:
        job.result_metadata = {**(job.result_metadata or {}), "source_key": source_key(job.job_id, suffix)}
        _stage_source(job.job_id, suffix, content)
        enqueue_outbox_event(
            db,
            event_type="import.requested",
            aggregate_type="background_job",
            aggregate_id=job.job_id,
            # Source bytes and paths never enter outbox/RabbitMQ metadata.
            metadata={"job_id": job.job_id, "job_type": job_type.value},
        )
    except Exception:
        delete_staged_source(job.job_id, suffix)
        raise
    return job, False


def import_job_summary(job: BackgroundJob) -> dict:
    """Expose progress without leaking staged source location or workbook content."""
    status = job.status.value if hasattr(job.status, "value") else str(job.status)
    job_type = job.job_type.value if hasattr(job.job_type, "value") else str(job.job_type)
    metadata = job.result_metadata if isinstance(job.result_metadata, dict) else {}
    return {
        "jobId": job.job_id,
        "jobType": job_type,
        "status": status,
        "totalRows": job.total_rows,
        "processedRows": job.processed_rows,
        "successRows": job.success_rows,
        "failedRows": job.failed_rows,
        "createdAt": job.created_at.isoformat() if job.created_at else None,
        "startedAt": job.started_at.isoformat() if job.started_at else None,
        "completedAt": job.completed_at.isoformat() if job.completed_at else None,
        "result": {key: value for key, value in metadata.items() if not key.startswith("source_")},
        "error": job.last_error if status == "FAILED" else None,
    }
