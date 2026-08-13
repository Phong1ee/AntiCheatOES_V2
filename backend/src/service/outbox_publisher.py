"""Transactional outbox publisher. Broker delivery never controls DB commits."""

from datetime import datetime
import time
from uuid import uuid4

from sqlalchemy.orm import Session

from src.a_db_config import OutboxEvent
from src.service.event_contract import build_event_envelope, sanitize_metadata
from src.service.rabbitmq_service import publish_envelope
from src.service.observability_service import current_request_id, log_event, tracing_metadata


def enqueue_outbox_event(
    db: Session,
    *,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str | int,
    metadata: dict | None = None,
) -> OutboxEvent:
    """Attach a small event to the caller's existing transaction without committing."""
    # Event contracts sanitize payloads; observability adds only a trace ID.
    event_metadata = dict(metadata or {})
    event_metadata.update(tracing_metadata(event_metadata))
    if (request_id := current_request_id()):
        event_metadata["request_id"] = request_id
    envelope = build_event_envelope(
        event_id=str(uuid4()),
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        metadata=event_metadata,
    )
    event = OutboxEvent(
        event_id=envelope["event_id"],
        event_type=envelope["event_type"],
        aggregate_type=envelope["aggregate_type"],
        aggregate_id=envelope["aggregate_id"],
        payload_json=envelope["metadata"],
    )
    db.add(event)
    log_event("outbox.enqueued", event_id=event.event_id, event_type=event.event_type, outbox_event_id=event.outbox_event_id)
    return event


def _envelope(event: OutboxEvent) -> dict:
    payload = event.payload_json if isinstance(event.payload_json, dict) else {}
    return build_event_envelope(
        event_id=event.event_id,
        event_type=event.event_type,
        aggregate_type=event.aggregate_type,
        aggregate_id=event.aggregate_id,
        occurred_at=event.created_at,
        metadata=sanitize_metadata(payload),
    )


def publish_pending(db: Session, *, limit: int = 100) -> int:
    """Publish confirmed pending rows, retaining failures for retry."""
    pending = (
        db.query(OutboxEvent)
        .filter(OutboxEvent.published_at.is_(None))
        .order_by(OutboxEvent.outbox_event_id)
        .with_for_update(skip_locked=True)
        .limit(limit)
        .all()
    )
    published = 0
    for event in pending:
        try:
            publish_envelope(_envelope(event))
            event.published_at = datetime.now()
            event.last_error = None
            published += 1
            log_event("outbox.published", event_id=event.event_id, event_type=event.event_type, outbox_event_id=event.outbox_event_id)
        except Exception as exc:
            event.retry_count += 1
            event.last_error = str(exc)[:2000]
            log_event("outbox.publish_failed", event_id=event.event_id, event_type=event.event_type, outbox_event_id=event.outbox_event_id)
    db.commit()
    return published


def run_forever(poll_seconds: float = 1.0) -> None:
    """Run the one initial publisher process; failures stay pending for retry."""
    from database import SessionLocal

    while True:
        db = SessionLocal()
        try:
            publish_pending(db)
        finally:
            db.close()
        time.sleep(poll_seconds)


if __name__ == "__main__":
    run_forever()
