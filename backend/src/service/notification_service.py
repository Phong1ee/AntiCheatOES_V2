"""Database operations for Student in-app notifications.

Creation helpers intentionally do not commit so Exam and assignment mutations
can include notification rows in their existing transaction.
"""

from collections.abc import Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.a_db_config import Notification, NotificationType


def create_notification(
    db: Session,
    *,
    student_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    exam_id: int | None = None,
) -> Notification:
    notification = Notification(
        student_id=student_id,
        exam_id=exam_id,
        type=notification_type,
        title=title,
        message=message,
    )
    db.add(notification)
    return notification


def create_notifications(
    db: Session,
    *,
    student_ids: Iterable[str],
    notification_type: NotificationType,
    title: str,
    message: str,
    exam_id: int | None = None,
) -> list[Notification]:
    """Stage one notification per distinct student in the caller's transaction."""
    return [
        create_notification(
            db,
            student_id=student_id,
            notification_type=notification_type,
            title=title,
            message=message,
            exam_id=exam_id,
        )
        for student_id in dict.fromkeys(student_ids)
    ]


def get_student_notifications(db: Session, student_id: str) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.student_id == student_id)
        .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
        .all()
    )


def get_unread_count(db: Session, student_id: str) -> int:
    return int(
        db.query(func.count(Notification.notification_id))
        .filter(Notification.student_id == student_id, Notification.is_read.is_(False))
        .scalar()
        or 0
    )


def mark_notification_read(
    db: Session, student_id: str, notification_id: int
) -> Notification | None:
    notification = (
        db.query(Notification)
        .filter(
            Notification.notification_id == notification_id,
            Notification.student_id == student_id,
        )
        .first()
    )
    if notification:
        notification.is_read = True
    return notification


def mark_all_notifications_read(db: Session, student_id: str) -> int:
    return int(
        db.query(Notification)
        .filter(Notification.student_id == student_id, Notification.is_read.is_(False))
        .update({Notification.is_read: True}, synchronize_session=False)
    )
