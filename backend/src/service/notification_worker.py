"""Durably acknowledge project notification requests without inventing a mail provider."""

from src.service.rabbitmq_worker import consume


def handle_notification_requested(envelope: dict, db) -> None:
    """Acknowledge a request; delivery remains unavailable without a transport."""
    if envelope.get("event_type") != "notification.requested":
        raise ValueError("notification.queue accepts notification.requested events only")
    aggregate_id = str(envelope.get("aggregate_id") or "").strip()
    if not aggregate_id:
        raise ValueError("notification.requested requires an aggregate_id")


def run_forever() -> None:
    consume("notification.queue", handle_notification_requested)


if __name__ == "__main__":
    run_forever()
