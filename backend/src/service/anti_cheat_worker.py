"""Derived anti-cheat analytics that never participates in enforcement."""

from src.a_db_config import Attempt
from src.service.audit_service import record_audit
from src.service.rabbitmq_worker import consume


def handle_violation_recorded(envelope: dict, db) -> None:
    """Snapshot authoritative state for audit analytics without changing the attempt."""
    if envelope.get("event_type") != "exam.violation.recorded":
        raise ValueError("anti_cheat.queue accepts exam.violation.recorded events only")
    try:
        attempt_id = int(envelope["aggregate_id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("exam.violation.recorded requires a numeric attempt aggregate_id") from exc
    attempt = db.query(Attempt).filter(Attempt.attempt_id == attempt_id).with_for_update().first()
    if not attempt:
        raise ValueError("Anti-cheat attempt not found")
    record_audit(
        db,
        actor_school_id=None,
        actor_role="system",
        action="ANTI_CHEAT_ANALYTICS_RECORDED",
        entity_type="attempt",
        entity_id=attempt_id,
        metadata={
            "event_id": envelope["event_id"],
            "violation_count": attempt.violation_count,
            "attempt_status": attempt.status.value if hasattr(attempt.status, "value") else str(attempt.status),
        },
    )


def run_forever() -> None:
    consume("anti_cheat.queue", handle_violation_recorded)


if __name__ == "__main__":
    run_forever()
