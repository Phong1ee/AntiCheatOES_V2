"""State-idempotent reconciliation for already-finalized grading events."""

from src.a_db_config import Attempt, AttemptStatus, Exam
from src.service.rabbitmq_worker import consume
from src.service.result_strategy_service import sync_student_final_score


_SUPPORTED_EVENTS = {"attempt.submitted", "grading.essay_graded"}


def handle_grading_event(envelope: dict, db) -> None:
    """Reconcile derived final scores; objective grading stays in submit's transaction."""
    if envelope.get("event_type") not in _SUPPORTED_EVENTS:
        raise ValueError("grading.queue received an unsupported event")
    try:
        attempt_id = int(envelope["aggregate_id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("grading event requires a numeric attempt aggregate_id") from exc

    attempt = db.query(Attempt).filter(Attempt.attempt_id == attempt_id).with_for_update().first()
    if not attempt:
        raise ValueError("Grading attempt not found")
    if attempt.status not in {AttemptStatus.submitted, AttemptStatus.terminated} or not attempt.submitted_at:
        return
    exam = db.get(Exam, attempt.exam_id)
    if not exam or not attempt.student_id:
        raise ValueError("Grading attempt has no valid exam or student")

    # This is a deterministic projection of persisted attempt and essay state.
    # It never recalculates objective answers or changes an attempt score.
    sync_student_final_score(db, exam, attempt.student_id)


def run_forever() -> None:
    consume("grading.queue", handle_grading_event)


if __name__ == "__main__":
    run_forever()
