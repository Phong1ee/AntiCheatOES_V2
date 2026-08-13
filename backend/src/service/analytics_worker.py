"""Small, auditable analytics receipt consumer for current derived events."""

from src.service.audit_service import record_audit
from src.service.rabbitmq_worker import consume


def handle_analytics_event(envelope: dict, db) -> None:
    """Record the derived event without mutating the source permission state."""
    if envelope.get("event_type") != "analytics.permission_updated":
        raise ValueError("analytics.queue accepts analytics.permission_updated events only")
    aggregate_id = str(envelope.get("aggregate_id") or "").strip()
    if not aggregate_id:
        raise ValueError("analytics.permission_updated requires an aggregate_id")
    record_audit(
        db,
        actor_school_id=None,
        actor_role="system",
        action="ANALYTICS_EVENT_RECORDED",
        entity_type=str(envelope.get("aggregate_type") or "analytics")[:50],
        entity_id=aggregate_id,
        metadata={"event_id": envelope["event_id"], "event_type": envelope["event_type"]},
    )


def run_forever() -> None:
    consume("analytics.queue", handle_analytics_event)


if __name__ == "__main__":
    run_forever()
