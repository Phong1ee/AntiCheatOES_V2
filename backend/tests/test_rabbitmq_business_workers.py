import json
import unittest
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import (
    Attempt,
    AttemptStatus,
    AuditLog,
    BackgroundJob,
    BackgroundJobStatus,
    BackgroundJobType,
    Exam,
    ProcessedEvent,
    StudentExam,
    Subject,
    User,
    UserRole,
)
from src.service.analytics_worker import handle_analytics_event
from src.service.anti_cheat_worker import handle_violation_recorded
from src.service.grading_worker import handle_grading_event
from src.service.import_worker import _mark_import_failed, handle_import_requested
from src.service.notification_worker import handle_notification_requested
from src.service.rabbitmq_worker import consume


class _FakeChannel:
    def __init__(self, deliveries):
        self.deliveries = deliveries
        self.callback = None
        self.acks = []
        self.rejects = []
        self.published = []

    def exchange_declare(self, **_):
        pass

    def queue_declare(self, **_):
        pass

    def queue_bind(self, **_):
        pass

    def basic_qos(self, **_):
        pass

    def basic_consume(self, **kwargs):
        self.callback = kwargs["on_message_callback"]

    def start_consuming(self):
        for method, properties, body in self.deliveries:
            self.callback(self, method, properties, body)

    def basic_ack(self, tag):
        self.acks.append(tag)

    def basic_reject(self, tag, requeue):
        self.rejects.append((tag, requeue))

    def basic_publish(self, **kwargs):
        self.published.append(kwargs)


class _FakeConnection:
    def __init__(self, channel):
        self._channel = channel

    def channel(self):
        return self._channel

    def close(self):
        pass


class RabbitMqBusinessWorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.db.add_all([
            User(school_id="T1", full_name="Teacher", email="teacher@workers.test", password_hash="x", role=UserRole.teacher),
            User(school_id="S1", full_name="Student", email="student@workers.test", password_hash="x", role=UserRole.student),
            User(school_id="A1", full_name="Admin", email="admin@workers.test", password_hash="x", role=UserRole.admin),
            Subject(subject_id="SUB", subject_name="Subject", subject_description="Worker subject"),
        ])
        self.db.flush()
        self.exam = Exam(manage_by="T1", title="Worker exam", examcode="WORKERS", max_attempt=1, duration_minutes=60, subject_id="SUB")
        self.db.add(self.exam)
        self.db.flush()
        self.attempt = Attempt(
            exam_id=self.exam.exam_id,
            student_id="S1",
            attempt_no=1,
            score=Decimal("72.00"),
            status=AttemptStatus.submitted,
            submitted_at=datetime.now(),
            end_time=datetime.now(),
        )
        self.db.add_all([self.attempt, StudentExam(student_id="S1", exam_id=self.exam.exam_id)])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    @staticmethod
    def _delivery(event_id, *, retries=0):
        envelope = {
            "event_id": event_id,
            "event_type": "notification.requested",
            "aggregate_type": "attempt",
            "aggregate_id": "1",
            "metadata": {},
        }
        return (
            SimpleNamespace(delivery_tag=event_id, routing_key="notification.requested"),
            SimpleNamespace(headers={"x-retry-count": retries}, message_id=event_id),
            json.dumps(envelope).encode(),
        )

    def _consume(self, channel, handler, *, exhausted=None):
        with patch("src.service.rabbitmq_worker._connection", return_value=_FakeConnection(channel)), patch(
            "src.service.rabbitmq_worker.SessionLocal", self.Session
        ):
            consume("notification.queue", handler, retry_limit=3, on_retry_exhausted=exhausted)

    def test_redelivery_creates_one_business_effect_across_worker_restart(self):
        effects = []

        def handler(envelope, db):
            effects.append(envelope["event_id"])
            db.add(AuditLog(actor_role="system", action="WORKER_EFFECT", entity_type="event", entity_id=envelope["event_id"]))

        delivery = self._delivery("event-restart")
        first = _FakeChannel([delivery])
        second = _FakeChannel([delivery])
        self._consume(first, handler)
        self._consume(second, handler)

        self.assertEqual(effects, ["event-restart"])
        self.assertEqual(self.db.query(ProcessedEvent).count(), 1)
        self.assertEqual(self.db.query(AuditLog).filter(AuditLog.action == "WORKER_EFFECT").count(), 1)
        self.assertEqual(first.acks, ["event-restart"])
        self.assertEqual(second.acks, ["event-restart"])

    def test_handler_failure_rolls_back_marker_retries_then_reaches_dlq(self):
        def failing_handler(_, db):
            db.add(AuditLog(actor_role="system", action="SHOULD_ROLLBACK", entity_type="event", entity_id="failure"))
            raise RuntimeError("transient failure")

        retry_channel = _FakeChannel([self._delivery("event-retry")])
        self._consume(retry_channel, failing_handler)
        self.assertEqual(self.db.query(ProcessedEvent).count(), 0)
        self.assertEqual(self.db.query(AuditLog).filter(AuditLog.action == "SHOULD_ROLLBACK").count(), 0)
        self.assertEqual(len(retry_channel.published), 1)
        self.assertEqual(retry_channel.published[0]["properties"].headers["x-retry-count"], 1)
        self.assertEqual(retry_channel.acks, ["event-retry"])

        exhausted = []
        dlq_channel = _FakeChannel([self._delivery("event-dlq", retries=3)])
        self._consume(dlq_channel, failing_handler, exhausted=lambda envelope, error, db: exhausted.append((envelope["event_id"], str(error))))
        self.assertEqual(dlq_channel.rejects, [("event-dlq", False)])
        self.assertEqual(exhausted, [("event-dlq", "transient failure")])
        self.assertEqual(self.db.query(ProcessedEvent).count(), 0)

    def test_grading_reconciles_final_score_without_regrading_attempt(self):
        handle_grading_event({"event_type": "attempt.submitted", "aggregate_id": str(self.attempt.attempt_id)}, self.db)
        self.db.commit()
        attempt = self.db.get(Attempt, self.attempt.attempt_id)
        student_exam = self.db.get(StudentExam, ("S1", self.exam.exam_id))
        self.assertEqual(attempt.score, Decimal("72.00"))
        self.assertEqual(student_exam.final_score, Decimal("72.00"))

        handle_grading_event({"event_type": "attempt.submitted", "aggregate_id": str(self.attempt.attempt_id)}, self.db)
        self.db.commit()
        self.assertEqual(self.db.get(StudentExam, ("S1", self.exam.exam_id)).final_score, Decimal("72.00"))

    def test_anti_cheat_analytics_cannot_change_authoritative_enforcement(self):
        self.attempt.status = AttemptStatus.terminated
        self.attempt.score = Decimal("0.00")
        self.attempt.violation_count = 5
        self.db.commit()
        handle_violation_recorded({"event_id": "anti-event", "event_type": "exam.violation.recorded", "aggregate_id": str(self.attempt.attempt_id)}, self.db)
        self.db.commit()

        attempt = self.db.get(Attempt, self.attempt.attempt_id)
        self.assertEqual((attempt.status, attempt.score, attempt.violation_count), (AttemptStatus.terminated, Decimal("0.00"), 5))
        self.assertEqual(self.db.query(AuditLog).filter(AuditLog.action == "ANTI_CHEAT_ANALYTICS_RECORDED").count(), 1)

    def test_notification_analytics_and_import_handlers_are_persisted_or_pending_execution(self):
        handle_notification_requested({"event_id": "notification-event", "event_type": "notification.requested", "aggregate_type": "attempt", "aggregate_id": str(self.attempt.attempt_id)}, self.db)
        handle_analytics_event({"event_id": "analytics-event", "event_type": "analytics.permission_updated", "aggregate_type": "teacher_permission", "aggregate_id": "T1"}, self.db)
        self.db.commit()
        self.assertEqual(self.db.query(AuditLog).filter(AuditLog.action.in_(["NOTIFICATION_REQUEST_RECORDED", "ANALYTICS_EVENT_RECORDED"])).count(), 2)

        job = BackgroundJob(job_type=BackgroundJobType.user_import, requested_by="A1", business_key_hash="a" * 64)
        self.db.add(job)
        self.db.commit()
        envelope = {"event_type": "import.requested", "aggregate_id": str(job.job_id)}
        with self.assertRaises(ValueError):
            handle_import_requested(envelope, self.db)
        self.db.rollback()
        _mark_import_failed(envelope, FileNotFoundError("missing source"), self.db)
        self.db.commit()
        self.assertEqual(self.db.get(BackgroundJob, job.job_id).status, BackgroundJobStatus.failed)


if __name__ == "__main__":
    unittest.main()
