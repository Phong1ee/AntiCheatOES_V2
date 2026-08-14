"""Derived anti-cheat analytics that never participates in enforcement."""

from src.a_db_config import Attempt
from src.service.rabbitmq_worker import consume


def handle_violation_recorded(envelope: dict, db) -> None:
    """Validate the derived event without duplicating authoritative violation data."""
    if envelope.get("event_type") != "exam.violation.recorded":
        raise ValueError("anti_cheat.queue accepts exam.violation.recorded events only")
    try:
        attempt_id = int(envelope["aggregate_id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("exam.violation.recorded requires a numeric attempt aggregate_id") from exc
    if not db.query(Attempt).filter(Attempt.attempt_id == attempt_id).with_for_update().first():
        raise ValueError("Anti-cheat attempt not found")


def run_forever() -> None:
    consume("anti_cheat.queue", handle_violation_recorded)


if __name__ == "__main__":
    run_forever()
