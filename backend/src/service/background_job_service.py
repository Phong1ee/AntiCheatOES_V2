"""Reusable database-only jobs. Message delivery is intentionally deferred to Prompt 12."""

from datetime import datetime
from hashlib import sha256
from typing import Any

from sqlalchemy.orm import Session

from src.a_db_config import BackgroundJob, BackgroundJobStatus, BackgroundJobType


def business_key_hash(business_key: str) -> str:
    normalized = business_key.strip()
    if not normalized:
        raise ValueError("A background job business key is required")
    return sha256(normalized.encode("utf-8")).hexdigest()


def get_or_create_job(
    db: Session,
    *,
    job_type: BackgroundJobType,
    requested_by: str,
    business_key: str,
    total_rows: int = 0,
    result_metadata: dict[str, Any] | None = None,
) -> tuple[BackgroundJob, bool]:
    """Create a logical job once; retried requests return the original row."""
    if total_rows < 0:
        raise ValueError("Background job total_rows cannot be negative")
    key_hash = business_key_hash(business_key)
    existing = (
        db.query(BackgroundJob)
        .filter(
            BackgroundJob.job_type == job_type,
            BackgroundJob.requested_by == requested_by,
            BackgroundJob.business_key_hash == key_hash,
        )
        .with_for_update()
        .first()
    )
    if existing:
        return existing, True

    job = BackgroundJob(
        job_type=job_type,
        requested_by=requested_by,
        business_key_hash=key_hash,
        total_rows=total_rows,
        result_metadata=result_metadata,
    )
    # Keep the row in the caller's transaction. In particular, a failed outbox
    # insert must roll this job back as well; callers retry duplicate-key races.
    db.add(job)
    db.flush()
    return job, False


def mark_job_running(db: Session, job_id: int) -> BackgroundJob:
    job = db.get(BackgroundJob, job_id, with_for_update=True)
    if not job:
        raise ValueError("Background job not found")
    if job.status == BackgroundJobStatus.pending:
        job.status = BackgroundJobStatus.running
        job.started_at = datetime.now()
    elif job.status != BackgroundJobStatus.running:
        raise ValueError("Only pending background jobs can be started")
    return job


def complete_job(
    db: Session,
    job_id: int,
    *,
    processed_rows: int,
    success_rows: int,
    failed_rows: int,
    result_metadata: dict[str, Any] | None = None,
) -> BackgroundJob:
    job = db.get(BackgroundJob, job_id, with_for_update=True)
    if not job:
        raise ValueError("Background job not found")
    if job.status not in {BackgroundJobStatus.pending, BackgroundJobStatus.running}:
        raise ValueError("Only pending or running background jobs can complete")
    if min(processed_rows, success_rows, failed_rows) < 0 or success_rows + failed_rows > processed_rows:
        raise ValueError("Background job row counts are invalid")
    job.status = BackgroundJobStatus.completed
    job.processed_rows = processed_rows
    job.success_rows = success_rows
    job.failed_rows = failed_rows
    job.result_metadata = result_metadata
    job.completed_at = datetime.now()
    return job


def update_job_progress(
    db: Session,
    job_id: int,
    *,
    processed_rows: int,
    success_rows: int,
    failed_rows: int,
    error_metadata: dict[str, Any] | None = None,
) -> BackgroundJob:
    """Persist committed import progress so redelivery can safely resume."""
    job = db.get(BackgroundJob, job_id, with_for_update=True)
    if not job or job.status != BackgroundJobStatus.running:
        raise ValueError("Only running background jobs can update progress")
    if min(processed_rows, success_rows, failed_rows) < 0 or success_rows + failed_rows > processed_rows:
        raise ValueError("Background job row counts are invalid")
    job.processed_rows = processed_rows
    job.success_rows = success_rows
    job.failed_rows = failed_rows
    if error_metadata:
        job.error_metadata = error_metadata
    return job


def fail_job(
    db: Session,
    job_id: int,
    *,
    error: str,
    error_metadata: dict[str, Any] | None = None,
) -> BackgroundJob:
    job = db.get(BackgroundJob, job_id, with_for_update=True)
    if not job:
        raise ValueError("Background job not found")
    if job.status not in {BackgroundJobStatus.pending, BackgroundJobStatus.running}:
        raise ValueError("Only pending or running background jobs can fail")
    job.status = BackgroundJobStatus.failed
    job.last_error = error.strip()[:2000] or "Background job failed"
    job.error_metadata = error_metadata
    job.completed_at = datetime.now()
    return job
