"""Deliver durable Exam emails from the notification queue."""

from datetime import datetime
import os

from src.a_db_config import (
    EmailDeliveryStatus,
    ExamEmailDelivery,
    ExamEmailDeliveryType,
    ExamStatus,
    StudentExam,
    User,
    UserRole,
)
from src.service.email_service import send_email
from src.service.exam_email_reminder_service import skip_delivery
from src.service.time_service import vietnam_now

from src.service.rabbitmq_worker import consume


def handle_notification_requested(envelope: dict, db) -> None:
    """Send one email; queue retries transient errors at most three times."""
    if envelope.get("event_type") != "notification.requested":
        raise ValueError("notification.queue accepts notification.requested events only")
    aggregate_id = str(envelope.get("aggregate_id") or "").strip()
    if not aggregate_id:
        raise ValueError("notification.requested requires an aggregate_id")
    if envelope.get("aggregate_type") != "exam_email_delivery":
        return
    delivery = db.get(ExamEmailDelivery, int(aggregate_id), with_for_update=True)
    if not delivery or delivery.status in {EmailDeliveryStatus.sent, EmailDeliveryStatus.failed} or delivery.skipped_at:
        return
    exam = delivery.exam
    student = delivery.student
    now = vietnam_now()
    assigned = db.get(StudentExam, (delivery.student_id, delivery.exam_id)) is not None
    if (
        not exam
        or not student
        or not assigned
        or exam.status != ExamStatus.published
        or not exam.start_time
        or exam.start_time <= now
        or student.role != UserRole.student
        or student.is_locked
        or student.deleted_at is not None
        or not student.email.strip()
    ):
        skip_delivery(delivery, "Recipient is no longer eligible for this exam email", now=now)
        return
    if (
        delivery.delivery_type == ExamEmailDeliveryType.reminder_30m
        and delivery.exam_start_time != exam.start_time
    ):
        skip_delivery(delivery, "Exam schedule changed before reminder delivery", now=now)
        return

    base_url = os.getenv("FRONTEND_ORIGIN", "").rstrip("/")
    if not base_url:
        raise RuntimeError("FRONTEND_ORIGIN is required for Exam email links")
    start_text = exam.start_time.strftime("%H:%M, %d/%m/%Y")
    if delivery.delivery_type == ExamEmailDeliveryType.reminder_30m:
        subject = f"Reminder: {exam.title} starts in 30 minutes"
        intro = "This is a reminder that your exam starts in 30 minutes."
    else:
        subject = f"New exam assigned: {exam.title}"
        intro = "You have been assigned to a new exam."
    body = "\n".join([
        f"Hi {student.full_name.strip() or 'Student'},",
        "",
        intro,
        f"Exam: {exam.title}",
        f"Start time (Asia/Ho_Chi_Minh): {start_text}",
        f"Open exam portal: {base_url}",
        "",
        "Please sign in with your student account to access the exam.",
    ])
    send_email(student.email, subject, body)
    delivery.status = EmailDeliveryStatus.sent
    delivery.sent_at = datetime.now()
    delivery.last_error = None


def _delivery_for_failure(envelope: dict, db):
    if envelope.get("aggregate_type") != "exam_email_delivery":
        return None
    try:
        return db.get(ExamEmailDelivery, int(envelope.get("aggregate_id") or ""), with_for_update=True)
    except (TypeError, ValueError):
        return None


def record_delivery_retry(envelope: dict, error: Exception, db) -> None:
    """Persist each retry separately because the handler transaction rolls back."""
    delivery = _delivery_for_failure(envelope, db)
    if delivery and delivery.status == EmailDeliveryStatus.queued and not delivery.skipped_at:
        delivery.retry_count += 1
        delivery.last_error = (str(error) or "Email delivery failed")[:2000]


def record_delivery_failure(envelope: dict, error: Exception, db) -> None:
    delivery = _delivery_for_failure(envelope, db)
    if delivery and delivery.status == EmailDeliveryStatus.queued and not delivery.skipped_at:
        delivery.status = EmailDeliveryStatus.failed
        delivery.retry_count = max(delivery.retry_count, 3)
        delivery.last_error = (str(error) or "Email delivery failed")[:2000]


def run_forever() -> None:
    consume(
        "notification.queue",
        handle_notification_requested,
        on_retry=record_delivery_retry,
        on_retry_exhausted=record_delivery_failure,
    )


if __name__ == "__main__":
    run_forever()
