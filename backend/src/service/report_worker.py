"""Entrypoint for the durable report export consumer."""

from src.a_db_config import BackgroundJob, BackgroundJobStatus
from src.service.background_job_service import fail_job
from src.service.rabbitmq_worker import consume
from src.service.report_job_service import handle_report_requested


def _mark_report_failed(envelope: dict, error: Exception, db) -> None:
    """Persist a terminal failure only after the shared worker used all retries."""
    try:
        job_id = int(envelope.get("aggregate_id"))
    except (TypeError, ValueError):
        return
    job = db.get(BackgroundJob, job_id, with_for_update=True)
    status = job.status.value if job and hasattr(job.status, "value") else (str(job.status) if job else "")
    if job and status in {BackgroundJobStatus.pending.value, BackgroundJobStatus.running.value}:
        fail_job(db, job_id, error=str(error), error_metadata={"event_type": envelope.get("event_type")})


def run_forever() -> None:
    consume("report.queue", handle_report_requested, on_retry_exhausted=_mark_report_failed)


if __name__ == "__main__":
    run_forever()
