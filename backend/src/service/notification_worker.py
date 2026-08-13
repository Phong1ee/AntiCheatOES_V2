"""Durably acknowledge project notification requests without inventing a mail provider."""

from src.service.audit_service import record_audit
from src.service.rabbitmq_worker import consume


def handle_notification_requested(envelope: dict, db) -> None:
    """Persist receipt once; delivery remains unavailable until a supported transport exists."""
    if envelope.get("event_type") != "notification.requested":
        raise ValueError("notification.queue accepts notification.requested events only")
    aggregate_id = str(envelope.get("aggregate_id") or "").strip()
    aggregate_type = str(envelope.get("aggregate_type") or "notification").strip()
    if not aggregate_id:
        raise ValueError("notification.requested requires an aggregate_id")
    record_audit(
        db,
        actor_school_id=None,
        actor_role="system",
        action="NOTIFICATION_REQUEST_RECORDED",
        entity_type=aggregate_type,
        entity_id=aggregate_id,
        metadata={"event_id": envelope["event_id"], "delivery": "not_configured"},
    )


def run_forever() -> None:
    consume("notification.queue", handle_notification_requested)


if __name__ == "__main__":
    run_forever()
