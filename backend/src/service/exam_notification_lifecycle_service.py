"""Idempotent processing for time-derived Exam open and close notifications."""

from datetime import datetime

from sqlalchemy import and_, exists, or_
from sqlalchemy.orm import Session

from database import SessionLocal
from src.a_db_config import (
    Exam,
    ExamNotificationLifecycle,
    ExamStatus,
    NotificationType,
    StudentExam,
)
from src.service.notification_service import create_notifications


def _status_value(value: object) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _due_exam_ids(db: Session, now: datetime, batch_size: int) -> list[int]:
    open_event_exists = exists().where(
        ExamNotificationLifecycle.exam_id == Exam.exam_id,
        ExamNotificationLifecycle.notification_type == NotificationType.EXAM_OPENED,
        ExamNotificationLifecycle.boundary_at == Exam.start_time,
    )
    close_event_exists = exists().where(
        ExamNotificationLifecycle.exam_id == Exam.exam_id,
        ExamNotificationLifecycle.notification_type == NotificationType.EXAM_CLOSED,
        ExamNotificationLifecycle.boundary_at == Exam.end_time,
    )
    return [
        exam_id
        for (exam_id,) in db.query(Exam.exam_id)
        .filter(
            Exam.status == ExamStatus.published,
            or_(
                and_(
                    Exam.start_time.isnot(None),
                    Exam.start_time <= now,
                    or_(Exam.end_time.is_(None), Exam.end_time > now),
                    ~open_event_exists,
                ),
                and_(
                    Exam.end_time.isnot(None),
                    Exam.end_time <= now,
                    ~close_event_exists,
                ),
            ),
        )
        .order_by(Exam.exam_id)
        .limit(batch_size)
        .all()
    ]


def _event_exists(
    db: Session,
    exam_id: int,
    notification_type: NotificationType,
    boundary_at: datetime,
) -> bool:
    return (
        db.query(ExamNotificationLifecycle.lifecycle_event_id)
        .filter(
            ExamNotificationLifecycle.exam_id == exam_id,
            ExamNotificationLifecycle.notification_type == notification_type,
            ExamNotificationLifecycle.boundary_at == boundary_at,
        )
        .first()
        is not None
    )


def _record_event_and_notify(
    db: Session,
    exam: Exam,
    notification_type: NotificationType,
    boundary_at: datetime,
) -> int:
    if _event_exists(db, exam.exam_id, notification_type, boundary_at):
        return 0
    db.add(
        ExamNotificationLifecycle(
            exam_id=exam.exam_id,
            notification_type=notification_type,
            boundary_at=boundary_at,
        )
    )
    student_ids = [
        student_id
        for (student_id,) in db.query(StudentExam.student_id)
        .filter(StudentExam.exam_id == exam.exam_id)
        .all()
    ]
    if notification_type == NotificationType.EXAM_OPENED:
        title = "Exam Opened"
        message = f'The exam "{exam.title}" is now available.'
    else:
        title = "Exam Closed"
        message = f'The exam "{exam.title}" is now closed.'
    create_notifications(
        db,
        student_ids=student_ids,
        exam_id=exam.exam_id,
        notification_type=notification_type,
        title=title,
        message=message,
    )
    return 1


def process_due_exam_notifications(
    db: Session,
    *,
    now: datetime | None = None,
    batch_size: int = 100,
) -> int:
    """Stage due lifecycle events in the supplied transaction without committing it."""
    current_time = now or datetime.now()
    emitted = 0
    for exam_id in _due_exam_ids(db, current_time, batch_size):
        # The lock serializes processors on MySQL; the unique boundary record is
        # a durable second line of defense for repeated runs and reschedules.
        exam = (
            db.query(Exam)
            .filter(Exam.exam_id == exam_id)
            .with_for_update()
            .first()
        )
        if not exam or _status_value(exam.status) != ExamStatus.published.value:
            continue
        if exam.end_time and current_time >= exam.end_time:
            emitted += _record_event_and_notify(
                db, exam, NotificationType.EXAM_CLOSED, exam.end_time
            )
            continue
        if exam.start_time and current_time >= exam.start_time:
            emitted += _record_event_and_notify(
                db, exam, NotificationType.EXAM_OPENED, exam.start_time
            )
    return emitted


def run_due_exam_notifications(*, now: datetime | None = None, batch_size: int = 100) -> int:
    """Runnable entry point for an external scheduled job; never starts a thread."""
    db = SessionLocal()
    try:
        emitted = process_due_exam_notifications(db, now=now, batch_size=batch_size)
        db.commit()
        return emitted
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_due_exam_notifications()
