import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import (
    BackgroundJob,
    BackgroundJobStatus,
    Exam,
    OutboxEvent,
    StudentExam,
    Subject,
    User,
    UserRole,
)
from src.route.teacherRoute.resultsRoute import (
    CreateReportJobRequest,
    create_exam_results_report_job,
)
from src.service.report_job_service import handle_report_requested, request_exam_results_report
from src.service.report_worker import _mark_report_failed


class ReportJobTests(unittest.TestCase):
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
            User(school_id="T1", full_name="Teacher One", email="t1@reports.test", password_hash="x", role=UserRole.teacher),
            User(school_id="T2", full_name="Teacher Two", email="t2@reports.test", password_hash="x", role=UserRole.teacher),
            User(school_id="S1", full_name="Student One", email="s1@reports.test", password_hash="x", role=UserRole.student),
            Subject(subject_id="DB", subject_name="Databases", subject_description="Database subject"),
        ])
        self.db.flush()
        self.exam = Exam(manage_by="T1", title="Results", examcode="REPORTS", max_attempt=1, duration_minutes=60, subject_id="DB")
        self.db.add(self.exam)
        self.db.flush()
        self.db.add(StudentExam(student_id="S1", exam_id=self.exam.exam_id, final_score=88))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_teacher_request_is_authorized_idempotent_and_writes_one_outbox_event(self):
        payload = CreateReportJobRequest(requestId="logical-request-1")
        first = create_exam_results_report_job(self.exam.exam_id, payload, {"school_id": "T1"}, {}, self.db)
        retry = create_exam_results_report_job(self.exam.exam_id, payload, {"school_id": "T1"}, {}, self.db)

        self.assertFalse(first["duplicate"])
        self.assertTrue(retry["duplicate"])
        self.assertEqual(first["jobId"], retry["jobId"])
        self.assertEqual(first["status"], "PENDING")
        events = self.db.query(OutboxEvent).filter(OutboxEvent.event_type == "report.requested").all()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].aggregate_id, str(first["jobId"]))
        self.assertEqual(events[0].payload_json, {"job_id": first["jobId"], "report_type": "exam_results", "exam_id": self.exam.exam_id})

        with self.assertRaises(HTTPException) as denied:
            create_exam_results_report_job(self.exam.exam_id, payload, {"school_id": "T2"}, {}, self.db)
        self.assertEqual(denied.exception.status_code, 403)

    def test_request_rolls_back_job_when_outbox_insert_fails(self):
        with patch("src.service.report_job_service.enqueue_outbox_event", side_effect=RuntimeError("outbox failed")):
            with self.assertRaisesRegex(RuntimeError, "outbox failed"):
                create_exam_results_report_job(
                    self.exam.exam_id,
                    CreateReportJobRequest(requestId="rollback-request"),
                    {"school_id": "T1"},
                    {},
                    self.db,
                )
        self.assertEqual(self.db.query(BackgroundJob).count(), 0)
        self.assertEqual(self.db.query(OutboxEvent).count(), 0)

    def test_worker_completion_and_redelivery_are_idempotent(self):
        job, _ = request_exam_results_report(
            self.db,
            exam_id=self.exam.exam_id,
            requested_by="T1",
            request_id="worker-request",
        )
        self.db.commit()
        envelope = {"event_type": "report.requested", "aggregate_id": str(job.job_id), "event_id": "report-event-1"}
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"REPORT_EXPORT_DIR": directory}):
            handle_report_requested(envelope, self.db)
            self.db.commit()
            completed = self.db.get(BackgroundJob, job.job_id)
            self.assertEqual(completed.status, BackgroundJobStatus.completed)
            self.assertTrue(os.path.isfile(os.path.join(directory, f"report_job_{job.job_id}.xlsx")))

            # A broker redelivery after the original commit leaves the completed job unchanged.
            handle_report_requested(envelope, self.db)
            self.db.commit()
            redelivered = self.db.get(BackgroundJob, job.job_id)
            self.assertEqual(redelivered.status, BackgroundJobStatus.completed)
            self.assertEqual(redelivered.success_rows, 1)

    def test_retry_exhaustion_marks_pending_job_failed(self):
        job, _ = request_exam_results_report(
            self.db,
            exam_id=self.exam.exam_id,
            requested_by="T1",
            request_id="failure-request",
        )
        self.db.commit()
        _mark_report_failed(
            {"event_type": "report.requested", "aggregate_id": str(job.job_id)},
            RuntimeError("storage unavailable"),
            self.db,
        )
        self.db.commit()
        failed = self.db.get(BackgroundJob, job.job_id)
        self.assertEqual(failed.status, BackgroundJobStatus.failed)
        self.assertEqual(failed.last_error, "storage unavailable")


if __name__ == "__main__":
    unittest.main()
