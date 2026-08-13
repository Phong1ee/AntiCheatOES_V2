import unittest

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import BackgroundJob, BackgroundJobStatus, BackgroundJobType, User, UserRole
from src.service.background_job_service import (
    business_key_hash,
    complete_job,
    fail_job,
    get_or_create_job,
    mark_job_running,
)


class BackgroundJobServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.db.add(User(school_id="A1", full_name="Admin", email="admin@jobs.test", password_hash="x", role=UserRole.admin))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_retry_business_key_returns_one_logical_job(self):
        first, duplicate = get_or_create_job(
            self.db,
            job_type=BackgroundJobType.user_import,
            requested_by="A1",
            business_key="user-import:file-sha256:abc",
            total_rows=3,
        )
        self.db.commit()
        second, duplicate_retry = get_or_create_job(
            self.db,
            job_type=BackgroundJobType.user_import,
            requested_by="A1",
            business_key="user-import:file-sha256:abc",
            total_rows=3,
        )

        self.assertFalse(duplicate)
        self.assertTrue(duplicate_retry)
        self.assertEqual(first.job_id, second.job_id)
        self.assertEqual(self.db.query(BackgroundJob).count(), 1)
        self.assertEqual(first.business_key_hash, business_key_hash("user-import:file-sha256:abc"))

    def test_state_transitions_record_progress_and_terminal_metadata(self):
        job, _ = get_or_create_job(
            self.db,
            job_type=BackgroundJobType.question_import,
            requested_by="A1",
            business_key="question-import:file-sha256:def",
            total_rows=2,
        )
        self.db.commit()

        mark_job_running(self.db, job.job_id)
        complete_job(
            self.db,
            job.job_id,
            processed_rows=2,
            success_rows=2,
            failed_rows=0,
            result_metadata={"question_ids": [1, 2]},
        )
        self.db.commit()

        completed = self.db.get(BackgroundJob, job.job_id)
        self.assertEqual(completed.status, BackgroundJobStatus.completed)
        self.assertEqual((completed.processed_rows, completed.success_rows, completed.failed_rows), (2, 2, 0))
        self.assertEqual(completed.result_metadata, {"question_ids": [1, 2]})
        self.assertIsNotNone(completed.started_at)
        self.assertIsNotNone(completed.completed_at)
        with self.assertRaisesRegex(ValueError, "Only pending or running"):
            fail_job(self.db, job.job_id, error="too late")

    def test_failed_job_is_terminal_and_keeps_bounded_error(self):
        job, _ = get_or_create_job(
            self.db,
            job_type=BackgroundJobType.report_export,
            requested_by="A1",
            business_key="report:exam:5",
        )
        fail_job(self.db, job.job_id, error="x" * 3000, error_metadata={"reason": "unavailable"})
        self.db.commit()

        failed = self.db.get(BackgroundJob, job.job_id)
        self.assertEqual(failed.status, BackgroundJobStatus.failed)
        self.assertEqual(len(failed.last_error), 2000)
        self.assertEqual(failed.error_metadata, {"reason": "unavailable"})


if __name__ == "__main__":
    unittest.main()
