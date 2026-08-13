"""Live RabbitMQ verification. Run only inside the disposable oes-verify stack."""

import os
import time
import unittest
from datetime import datetime
from decimal import Decimal
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4

import pika
from openpyxl import Workbook

from database import SessionLocal
from src.a_db_config import (
    Attempt,
    AttemptStatus,
    AuditLog,
    BackgroundJob,
    BackgroundJobStatus,
    BackgroundJobType,
    Exam,
    OutboxEvent,
    ProcessedEvent,
    StudentExam,
    Subject,
    User,
    UserRole,
)
from src.service.event_contract import build_event_envelope
from src.service.import_job_service import queue_import_job
from src.service.outbox_publisher import _envelope, enqueue_outbox_event, publish_pending
from src.service.rabbitmq_service import QUEUES, _connection, declare_topology, publish_envelope
from src.service.report_job_service import request_exam_results_report


@unittest.skipUnless(os.getenv("RUN_RABBITMQ_E2E") == "1", "requires disposable oes-verify stack")
class RabbitMqLiveE2ETests(unittest.TestCase):
    @staticmethod
    def _wait(predicate, message: str, seconds: float = 20.0):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(0.25)
        raise AssertionError(message)

    @staticmethod
    def _xlsx(suffix: str) -> bytes:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Users"
        sheet.append(["school_id", "full_name", "email", "role", "phone", "date_of_birth", "initial_password"])
        sheet.append([f"S-IMPORT-{suffix}", "Worker Student", f"worker-{suffix}@live.test", "student", None, "2005-01-01", "password123"])
        output = BytesIO()
        workbook.save(output)
        return output.getvalue()

    def setUp(self):
        self.db = SessionLocal()
        suffix = uuid4().hex[:10]
        self.import_student_id = f"S-IMPORT-{suffix}"
        self.admin = User(school_id=f"A{suffix}", full_name="Live Admin", email=f"admin-{suffix}@live.test", password_hash="x", role=UserRole.admin)
        self.teacher = User(school_id=f"T{suffix}", full_name="Live Teacher", email=f"teacher-{suffix}@live.test", password_hash="x", role=UserRole.teacher)
        self.student = User(school_id=f"S{suffix}", full_name="Live Student", email=f"student-{suffix}@live.test", password_hash="x", role=UserRole.student)
        self.subject = Subject(subject_id=f"L{suffix[:8]}", subject_name="Live Subject", subject_description="Live event verification")
        self.db.add_all([self.admin, self.teacher, self.student, self.subject])
        self.db.flush()
        self.exam = Exam(
            manage_by=self.teacher.school_id,
            title="Live exam",
            examcode=f"LIVE-{suffix}",
            max_attempt=1,
            duration_minutes=60,
            subject_id=self.subject.subject_id,
        )
        self.db.add(self.exam)
        self.db.flush()
        self.attempt = Attempt(
            exam_id=self.exam.exam_id,
            student_id=self.student.school_id,
            attempt_no=1,
            score=Decimal("80.00"),
            status=AttemptStatus.submitted,
            submitted_at=datetime.now(),
            end_time=datetime.now(),
            violation_count=1,
        )
        self.db.add_all([self.attempt, StudentExam(student_id=self.student.school_id, exam_id=self.exam.exam_id)])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_topology_and_all_workloads_consume_with_durable_idempotency(self):
        # Tests share the disposable database, so do not include deliberately
        # poisoned events created by another test in this workload assertion.
        outbox_start = max(
            (row.outbox_event_id for row in self.db.query(OutboxEvent.outbox_event_id).all()),
            default=0,
        )
        connection = _connection()
        try:
            channel = connection.channel()
            declare_topology(channel)
            for queue in QUEUES:
                declared = channel.queue_declare(queue=queue, passive=True)
                self.assertEqual(declared.method.queue, queue)
                self.assertIsNotNone(channel.queue_declare(queue=f"{queue}.dlq", passive=True).method.queue)
        finally:
            connection.close()

        report, _ = request_exam_results_report(
            self.db, exam_id=self.exam.exam_id, requested_by=self.teacher.school_id, request_id=f"live-{uuid4()}"
        )
        import_job, _ = queue_import_job(
            self.db,
            job_type=BackgroundJobType.user_import,
            requested_by=self.admin.school_id,
            filename="users.xlsx",
            content=self._xlsx(self.import_student_id.removeprefix("S-IMPORT-")),
            total_rows=1,
            scope=f"live:{uuid4()}",
        )
        events = [
            ("attempt.submitted", "attempt", self.attempt.attempt_id, {"exam_id": self.exam.exam_id}),
            ("notification.requested", "attempt", self.attempt.attempt_id, {"kind": "live"}),
            ("analytics.permission_updated", "teacher_permission", self.teacher.school_id, {"active_subject_count": 1}),
            ("exam.violation.recorded", "attempt", self.attempt.attempt_id, {"event_type": "TAB_HIDDEN"}),
        ]
        for event_type, aggregate_type, aggregate_id, metadata in events:
            enqueue_outbox_event(self.db, event_type=event_type, aggregate_type=aggregate_type, aggregate_id=aggregate_id, metadata=metadata)
        self.db.commit()

        def all_published():
            check = SessionLocal()
            try:
                return (
                    check.query(OutboxEvent)
                    .filter(OutboxEvent.outbox_event_id > outbox_start, OutboxEvent.published_at.isnot(None))
                    .count()
                    >= 6
                )
            finally:
                check.close()

        self._wait(all_published, "outbox publisher did not confirm all workload events")
        outbox_rows = (
            self.db.query(OutboxEvent)
            .filter(OutboxEvent.outbox_event_id > outbox_start, OutboxEvent.published_at.isnot(None))
            .all()
        )
        self.assertGreaterEqual(len(outbox_rows), 6)
        sensitive = ("password", "token", "jwt", "session", "audio", "video", "image", "biometric", "answer")
        for row in outbox_rows:
            self.assertFalse(any(key in str(row.payload_json).lower() for key in sensitive))

        expected = {
            "grading.queue", "notification.queue", "analytics.queue", "anti_cheat.queue", "report.queue", "import.queue",
        }
        event_ids = [row.event_id for row in outbox_rows]

        def all_processed():
            check = SessionLocal()
            try:
                consumers = {item.consumer_name for item in check.query(ProcessedEvent).filter(ProcessedEvent.event_id.in_(event_ids)).all()}
                return expected.issubset(consumers)
            finally:
                check.close()

        self._wait(all_processed, "one or more live workers did not commit their processed-event marker")

        # MySQL's default repeatable-read snapshot on the fixture session can
        # predate worker commits. Poll through a new session for live state.
        def workloads_completed():
            check = SessionLocal()
            try:
                return (
                    check.get(BackgroundJob, report.job_id).status == BackgroundJobStatus.completed
                    and check.get(BackgroundJob, import_job.job_id).status == BackgroundJobStatus.completed
                    and check.get(StudentExam, (self.student.school_id, self.exam.exam_id)).final_score == Decimal("80.00")
                )
            finally:
                check.close()

        self._wait(workloads_completed, "live worker business effects were not committed")
        self.db.rollback()
        self.db.expire_all()
        self.assertEqual(self.db.get(BackgroundJob, report.job_id).status, BackgroundJobStatus.completed)
        self.assertEqual(self.db.get(BackgroundJob, import_job.job_id).status, BackgroundJobStatus.completed)
        self.assertEqual(self.db.get(StudentExam, (self.student.school_id, self.exam.exam_id)).final_score, Decimal("80.00"))
        before = self.db.query(AuditLog).count()

        # Simulate broker redelivery after a committed handler before an ACK.
        for row in outbox_rows:
            publish_envelope(_envelope(row))

        time.sleep(2)
        self.db.expire_all()
        self.assertEqual(self.db.query(AuditLog).count(), before)
        self.assertEqual(self.db.get(BackgroundJob, import_job.job_id).success_rows, 1)
        self.assertEqual(self.db.get(StudentExam, (self.student.school_id, self.exam.exam_id)).final_score, Decimal("80.00"))

    def test_every_worker_bounds_poison_retries_then_dead_letters(self):
        # Each event reaches one concrete worker but is deliberately outside
        # its allowlist. This exercises the shared retry/DLQ path without
        # mutating any business source-of-truth record.
        poisons = (
            ("grading.queue", "grading.invalid"),
            ("notification.queue", "notification.invalid"),
            ("report.queue", "report.invalid"),
            ("analytics.queue", "analytics.invalid"),
            ("anti_cheat.queue", "exam.violation.invalid"),
            ("import.queue", "import.invalid"),
        )
        for queue, event_type in poisons:
            connection = _connection()
            try:
                channel = connection.channel()
                before = channel.queue_declare(queue=f"{queue}.dlq", passive=True).method.message_count
            finally:
                connection.close()
            poison = build_event_envelope(
                event_type=event_type,
                aggregate_type="test",
                aggregate_id="poison",
                event_id=str(uuid4()),
                metadata={"kind": "controlled_failure"},
            )
            publish_envelope(poison)

            def in_dlq():
                connection = _connection()
                try:
                    channel = connection.channel()
                    return channel.queue_declare(queue=f"{queue}.dlq", passive=True).method.message_count >= before + 1
                finally:
                    connection.close()

            self._wait(in_dlq, f"poison {queue} event did not reach its DLQ after bounded retries")
            check = SessionLocal()
            try:
                self.assertEqual(check.query(ProcessedEvent).filter(ProcessedEvent.event_id == poison["event_id"]).count(), 0)
            finally:
                check.close()

    def test_publish_failure_keeps_outbox_pending_until_broker_recovers(self):
        event = enqueue_outbox_event(
            self.db,
            event_type="analytics.permission_updated",
            aggregate_type="teacher_permission",
            aggregate_id=self.teacher.school_id,
            metadata={"active_subject_count": 1},
        )
        self.db.commit()
        with patch("src.service.outbox_publisher.publish_envelope", side_effect=RuntimeError("broker unavailable")):
            self.assertEqual(publish_pending(self.db), 0)
        pending = self.db.get(OutboxEvent, event.outbox_event_id)
        self.assertIsNone(pending.published_at)
        self.assertEqual(pending.retry_count, 1)


if __name__ == "__main__":
    unittest.main()
