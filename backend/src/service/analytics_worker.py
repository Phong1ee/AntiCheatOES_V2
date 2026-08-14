"""Small, auditable analytics receipt consumer for current derived events."""

from src.service.rabbitmq_worker import consume


def handle_analytics_event(envelope: dict, db) -> None:
    """Acknowledge a derived telemetry event without writing shared audit rows."""
    if envelope.get("event_type") != "analytics.permission_updated":
        raise ValueError("analytics.queue accepts analytics.permission_updated events only")
    aggregate_id = str(envelope.get("aggregate_id") or "").strip()
    if not aggregate_id:
        raise ValueError("analytics.permission_updated requires an aggregate_id")


def run_forever() -> None:
    consume("analytics.queue", handle_analytics_event)


if __name__ == "__main__":
    run_forever()
