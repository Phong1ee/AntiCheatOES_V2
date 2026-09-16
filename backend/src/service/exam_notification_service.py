"""Notification integration helpers for Teacher Exam mutations."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from src.a_db_config import Exam, NotificationType, StudentExam
from src.service.notification_service import create_notifications


def _status_value(value: object) -> str:
    return value.value if hasattr(value, "value") else str(value)


@dataclass(frozen=True)
class ExamNotificationSnapshot:
    start_time: object
    end_time: object
    duration_minutes: object
    examcode: object
    status: str


def snapshot_exam_notification_fields(exam: Exam) -> ExamNotificationSnapshot:
    return ExamNotificationSnapshot(
        start_time=exam.start_time,
        end_time=exam.end_time,
        duration_minutes=exam.duration_minutes,
        examcode=exam.examcode,
        status=_status_value(exam.status),
    )


def _assigned_student_ids(db: Session, exam_id: int) -> list[str]:
    return [
        student_id
        for (student_id,) in db.query(StudentExam.student_id)
        .filter(StudentExam.exam_id == exam_id)
        .all()
    ]


def notify_new_exam_assignments(db: Session, exam: Exam, student_ids: set[str]) -> None:
    if not student_ids:
        return
    create_notifications(
        db,
        student_ids=sorted(student_ids),
        exam_id=exam.exam_id,
        notification_type=NotificationType.NEW_EXAM_ASSIGNED,
        title="New Exam Assigned",
        message=f'You have been assigned to a new exam: "{exam.title}".',
    )


def notify_exam_changes(
    db: Session,
    exam: Exam,
    previous: ExamNotificationSnapshot,
) -> list[NotificationType]:
    """Stage all relevant change notifications without committing the caller's unit of work."""
    changes: list[tuple[NotificationType, str, str]] = []
    if previous.start_time != exam.start_time or previous.end_time != exam.end_time:
        changes.append((
            NotificationType.EXAM_SCHEDULE_CHANGED,
            "Exam Schedule Changed",
            f'The schedule for "{exam.title}" has been changed.',
        ))
    if previous.duration_minutes != exam.duration_minutes:
        changes.append((
            NotificationType.EXAM_DURATION_CHANGED,
            "Exam Duration Changed",
            f'The duration for "{exam.title}" has been changed.',
        ))
    if previous.examcode != exam.examcode:
        changes.append((
            NotificationType.EXAM_CODE_CHANGED,
            "Exam Code Changed",
            f'The access code for "{exam.title}" has been changed.',
        ))
    if previous.status != "cancelled" and _status_value(exam.status) == "cancelled":
        changes.append((
            NotificationType.EXAM_CANCELLED,
            "Exam Cancelled",
            f'The exam "{exam.title}" has been cancelled.',
        ))

    if not changes:
        return []
    student_ids = _assigned_student_ids(db, exam.exam_id)
    for notification_type, title, message in changes:
        create_notifications(
            db,
            student_ids=student_ids,
            exam_id=exam.exam_id,
            notification_type=notification_type,
            title=title,
            message=message,
        )
    return [notification_type for notification_type, _, _ in changes]
