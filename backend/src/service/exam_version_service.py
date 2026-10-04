from fastapi import HTTPException
from fastapi.params import Query
from sqlalchemy.orm import Session

from src.a_db_config import Attempt, AttemptStatus, Exam, ExamStatus
from src.service.teacher_subject_service import require_active_subject_assignment

STARTED_EXAM_LOCK_MESSAGE = (
    "This published exam is locked because a student has already started it."
)


def exam_has_started_attempts(db: Session, exam_id: int) -> bool:
    """True when any student has an attempt of any status on the exam."""
    return (
        db.query(Attempt.attempt_id).filter(Attempt.exam_id == exam_id).first()
        is not None
    )


def is_exam_content_locked(db: Session, exam: Exam) -> bool:
    status = exam.status.value if hasattr(exam.status, "value") else exam.status
    return status == ExamStatus.published.value and exam_has_started_attempts(
        db, exam.exam_id
    )


def claim_exam_version(
    db: Session,
    exam_id: int,
    teacher_school_id: str,
    expected_version: int | None,
    *,
    allow_started_exam: bool = False,
) -> Exam:
    """Atomically claim the next version before a Teacher Exam Manager write."""
    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.manage_by != teacher_school_id:
        raise HTTPException(status_code=403, detail="You do not manage this exam")
    # Ownership alone must not outlive an Admin's subject-permission revoke.
    # This query is intentionally uncached: mutation authorization is always
    # decided from the current MySQL teacher_subject state.
    require_active_subject_assignment(db, teacher_school_id, exam.subject_id)

    # An active attempt must see the exact exam configuration it accepted at
    # Start. Reject all Exam Manager writes before advancing the version.
    active_attempt = (
        db.query(Attempt.attempt_id)
        .filter(
            Attempt.exam_id == exam_id,
            Attempt.status == AttemptStatus.in_progress,
            Attempt.submitted_at.is_(None),
            Attempt.end_time.is_(None),
        )
        .first()
    )
    if active_attempt:
        raise HTTPException(
            status_code=409,
            detail="This exam is locked while a student has an attempt in progress.",
        )
    # Only non-content writes (assignment additions, result visibility, etc.) opt out.
    if not allow_started_exam and is_exam_content_locked(db, exam):
        raise HTTPException(status_code=409, detail=STARTED_EXAM_LOCK_MESSAGE)

    # Direct unit calls receive FastAPI's Query default object rather than None.
    expected = expected_version if isinstance(expected_version, int) else exam.version
    changed = (
        db.query(Exam)
        .filter(
            Exam.exam_id == exam_id,
            Exam.manage_by == teacher_school_id,
            Exam.version == expected,
        )
        .update({Exam.version: Exam.version + 1}, synchronize_session=False)
    )
    if changed != 1:
        db.expire_all()
        current = db.get(Exam, exam_id)
        if not current:
            raise HTTPException(status_code=404, detail="Exam not found")
        if current.manage_by != teacher_school_id:
            raise HTTPException(status_code=403, detail="You do not manage this exam")
        raise HTTPException(
            status_code=409,
            detail="This exam changed before the save could be applied. Reload and try again.",
        )
    db.expire(exam)
    return db.get(Exam, exam_id)
