import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import (
    EmailDeliveryStatus,
    Exam,
    ExamEmailDelivery,
    ExamEmailDeliveryType,
    ExamStatus,
    OutboxEvent,
    StudentExam,
    Subject,
    User,
    UserRole,
)
from src.service.exam_email_reminder_service import queue_due_exam_reminders, queue_new_assignment_emails
from src.service.notification_worker import handle_notification_requested


class ExamEmailReminderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.now = datetime(2026, 9, 30, 9, 0)
        self.db.add_all([
            User(school_id="T1", full_name="Teacher", email="teacher@test", password_hash="x", role=UserRole.teacher),
            User(school_id="S1", full_name="Student", email="student@test", password_hash="x", role=UserRole.student),
            Subject(subject_id="SUB", subject_name="Subject", subject_description="Test"),
        ])
        self.db.flush()
        self.exam = Exam(
            manage_by="T1", title="Email exam", max_attempt=1, duration_minutes=60,
            start_time=self.now + timedelta(minutes=30), end_time=self.now + timedelta(hours=2),
            status=ExamStatus.published, subject_id="SUB",
        )
        self.db.add(self.exam)
        self.db.flush()
        self.db.add(StudentExam(student_id="S1", exam_id=self.exam.exam_id))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_assignment_email_is_idempotent_and_uses_outbox(self):
        with patch("src.service.exam_email_reminder_service.vietnam_now", return_value=self.now):
            self.assertEqual(queue_new_assignment_emails(self.db, self.exam, {"S1"}), 1)
            self.assertEqual(queue_new_assignment_emails(self.db, self.exam, {"S1"}), 0)
        self.db.commit()
        delivery = self.db.query(ExamEmailDelivery).one()
        self.assertEqual(delivery.delivery_type, ExamEmailDeliveryType.exam_assigned)
        self.assertEqual(self.db.query(OutboxEvent).count(), 1)

    def test_reminder_follows_current_schedule_and_does_not_duplicate(self):
        self.assertEqual(queue_due_exam_reminders(self.db, now=self.now), 1)
        self.assertEqual(queue_due_exam_reminders(self.db, now=self.now), 0)
        self.db.commit()
        delivery = self.db.query(ExamEmailDelivery).one()
        self.assertEqual(delivery.delivery_type, ExamEmailDeliveryType.reminder_30m)
        self.exam.start_time += timedelta(hours=1)
        self.db.commit()
        with patch("src.service.notification_worker.send_email") as send, patch(
            "src.service.notification_worker.vietnam_now", return_value=self.now
        ):
            handle_notification_requested(
                {"event_type": "notification.requested", "aggregate_type": "exam_email_delivery", "aggregate_id": str(delivery.delivery_id)},
                self.db,
            )
        self.db.commit()
        self.assertFalse(send.called)
        self.assertIsNotNone(self.db.get(ExamEmailDelivery, delivery.delivery_id).skipped_at)

    def test_worker_sends_no_exam_code_and_records_sent_status(self):
        queue_due_exam_reminders(self.db, now=self.now)
        self.db.commit()
        delivery = self.db.query(ExamEmailDelivery).one()
        self.exam.examcode = "SECRET-CODE"
        self.db.commit()
        with patch("src.service.notification_worker.send_email") as send, patch(
            "src.service.notification_worker.vietnam_now", return_value=self.now
        ), patch.dict("os.environ", {"FRONTEND_ORIGIN": "https://frontend.test"}, clear=False):
            handle_notification_requested(
                {"event_type": "notification.requested", "aggregate_type": "exam_email_delivery", "aggregate_id": str(delivery.delivery_id)},
                self.db,
            )
        self.db.commit()
        _, _, body = send.call_args.args
        self.assertNotIn("SECRET-CODE", body)
        self.assertIn("https://frontend.test/student/exams/", body)
        saved = self.db.get(ExamEmailDelivery, delivery.delivery_id)
        self.assertEqual(saved.status, EmailDeliveryStatus.sent)
        self.assertIsNotNone(saved.sent_at)


if __name__ == "__main__":
    unittest.main()
