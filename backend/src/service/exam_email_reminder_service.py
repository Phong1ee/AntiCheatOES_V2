"""Durable Exam email requests and the 30-minute reminder scheduler."""

from __future__ import annotations

from datetime import datetime, timedelta
from hashlib import sha256

from sqlalchemy.orm import Session

from src.a_db_config import (
    Exam,
    ExamEmailDelivery,
    ExamEmailDeliveryType,
    ExamStatus,
    StudentExam,
)
from src.service.outbox_publisher import enqueue_outbox_event
from src.service.time_service import vietnam_now

REMINDER_LEAD_TIME = timedelta(minutes=30)


def _value(value: object) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _delivery_key(exam_id: int, student_id: str, delivery_type: ExamEmailDeliveryType, start_time: datetime | None) -> str:
    # A hash is index-safe and records no student identifier in an index value.
    source = f"{exam_id}:{student_id}:{delivery_type.value}:{start_time.isoformat() if start_time else ''}"
    return sha256(source.encode("utf-8")).hexdigest()


def _queue_delivery(
    db: Session,
    *,
    exam: Exam,
    student_id: str,
    delivery_type: ExamEmailDeliveryType,
    scheduled_for: datetime,
    start_time: datetime | None,
) -> ExamEmailDelivery | None:
    key = _delivery_key(exam.exam_id, student_id, delivery_type, start_time)
    existing = db.query(ExamEmailDelivery).filter_by(delivery_key=key).with_for_update().first()
    if existing:
        return None
    delivery = ExamEmailDelivery(
        exam_id=exam.exam_id,
        student_id=student_id,
        delivery_type=delivery_type,
        exam_start_time=start_time,
        scheduled_for=scheduled_for,
        delivery_key=key,
    )
    db.add(delivery)
    db.flush()
    enqueue_outbox_event(
        db,
        event_type="notification.requested",
        aggregate_type="exam_email_delivery",
        aggregate_id=delivery.delivery_id,
        metadata={"email_delivery_id": delivery.delivery_id, "exam_id": exam.exam_id},
    )
    return delivery


def queue_new_assignment_emails(db: Session, exam: Exam, student_ids: set[str]) -> int:
    """Queue the first email only for newly assigned students on a published exam."""
    if _value(exam.status) != ExamStatus.published.value or not exam.start_time:
        return 0
    return sum(
        _queue_delivery(
            db,
            exam=exam,
            student_id=student_id,
            delivery_type=ExamEmailDeliveryType.exam_assigned,
            scheduled_for=vietnam_now(),
            start_time=None,
        )
        is not None
        for student_id in student_ids
    )


def queue_existing_assignment_emails_on_publish(db: Session, exam: Exam) -> int:
    student_ids = {
        student_id
        for (student_id,) in db.query(StudentExam.student_id).filter(StudentExam.exam_id == exam.exam_id).all()
    }
    return queue_new_assignment_emails(db, exam, student_ids)


def queue_due_exam_reminders(db: Session, *, now: datetime | None = None, batch_size: int = 100) -> int:
    """Create due reminder jobs; worker delivery is intentionally separate."""
    current_time = now or vietnam_now()
    exams = (
        db.query(Exam)
        .filter(
            Exam.status == ExamStatus.published,
            Exam.start_time.isnot(None),
            Exam.start_time > current_time,
            Exam.start_time <= current_time + REMINDER_LEAD_TIME,
        )
        .order_by(Exam.start_time, Exam.exam_id)
        .limit(batch_size)
        .with_for_update(skip_locked=True)
        .all()
    )
    queued = 0
    for exam in exams:
        scheduled_for = exam.start_time - REMINDER_LEAD_TIME
        student_ids = [
            student_id
            for (student_id,) in db.query(StudentExam.student_id).filter(StudentExam.exam_id == exam.exam_id).all()
        ]
        for student_id in student_ids:
            queued += _queue_delivery(
                db,
                exam=exam,
                student_id=student_id,
                delivery_type=ExamEmailDeliveryType.reminder_30m,
                scheduled_for=scheduled_for,
                start_time=exam.start_time,
            ) is not None
    return queued


def skip_delivery(delivery: ExamEmailDelivery, reason: str, *, now: datetime | None = None) -> None:
    """Keep an auditable no-send record without misreporting it as a provider failure."""
    delivery.skipped_at = now or vietnam_now()
    delivery.last_error = reason[:2000]


