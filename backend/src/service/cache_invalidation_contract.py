"""Cache invalidation intents only; Redis delivery is intentionally deferred to Prompt 11."""

from dataclasses import dataclass

from src.service.event_contract import build_event_envelope
from src.service.cache_service import (
    delete_prefix,
    invalidate_admin_teacher_permissions,
    invalidate_teacher_question_bank,
    teacher_subjects_key,
)


@dataclass(frozen=True)
class InvalidationIntent:
    scope: str
    key: str

    def as_event_metadata(self) -> dict[str, str]:
        return {"cache_scope": self.scope, "cache_key": self.key}


def _identifier(value: str | int, name: str) -> str:
    normalized = str(value).strip()
    if not normalized:
        raise ValueError(f"{name} is required")
    return normalized


def teacher_exam_updated(exam_id: int) -> InvalidationIntent:
    return InvalidationIntent("teacher_exam", f"exam:{_identifier(exam_id, 'exam_id')}")


def teacher_assignment_changed(exam_id: int) -> InvalidationIntent:
    return InvalidationIntent("teacher_assignment", f"exam-assignments:{_identifier(exam_id, 'exam_id')}")


def admin_permission_updated(teacher_school_id: str) -> InvalidationIntent:
    return InvalidationIntent("admin_permission", f"teacher-permissions:{_identifier(teacher_school_id, 'teacher_school_id')}")


def admin_enrollment_updated(class_id: int) -> InvalidationIntent:
    return InvalidationIntent("admin_enrollment", f"class-roster:{_identifier(class_id, 'class_id')}")


def teacher_grading_finalized(exam_id: int) -> InvalidationIntent:
    return InvalidationIntent("teacher_grading", f"exam-results:{_identifier(exam_id, 'exam_id')}")


def invalidation_event(intent: InvalidationIntent, *, aggregate_type: str, aggregate_id: str | int) -> dict:
    """A safe envelope ready for a later Redis/outbox adapter, without delivering it."""
    return build_event_envelope(
        event_type="cache.invalidation.requested",
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        metadata=intent.as_event_metadata(),
    )


def deliver_invalidation(intent: InvalidationIntent) -> None:
    """Best-effort Redis delivery for the Prompt 10 intent after DB commit."""
    if intent.scope == "admin_permission":
        teacher_id = intent.key.removeprefix("teacher-permissions:")
        delete_prefix(teacher_subjects_key(teacher_id))
        invalidate_teacher_question_bank(teacher_id)
        invalidate_admin_teacher_permissions()
    elif intent.scope == "teacher_assignment":
        # The intent contains an Exam, not a roster; clear only Student list keys.
        delete_prefix("oes:v1:student:exams")
    elif intent.scope == "teacher_exam":
        delete_prefix("oes:v1:exam")
    elif intent.scope == "admin_enrollment":
        delete_prefix("oes:v1:student:exams")
    elif intent.scope == "teacher_grading":
        delete_prefix("oes:v1:results")
