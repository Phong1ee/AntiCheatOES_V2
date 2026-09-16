import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import (
    CourseClass,
    Exam,
    ExamNotificationLifecycle,
    ExamStatus,
    Notification,
    NotificationType,
    StudentClass,
    StudentExam,
    Subject,
    TeacherSubject,
    User,
)
from src.models.teacher.requestModel.TeacherExamRequest import (
    TeacherExamRequest,
    TeacherExamStatusRequest,
)
from src.route.teacherRoute.addExamRoute import update_exam_in_database, update_exam_status
from src.route.teacherRoute.getExamsRoute import AssignmentSyncRequest, sync_assignments
from src.controller.teacherController.examController import ExamController
from src.models.teacher import examModel
from src.service.exam_notification_lifecycle_service import process_due_exam_notifications


class ExamNotificationIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        event.listen(
            cls.engine,
            "connect",
            lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"),
        )
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        now = datetime(2026, 9, 16, 8, 0)
        self.db.add_all(
            [
                User(school_id="T1", full_name="Teacher", email="t1@test", password_hash="x", role="teacher"),
                User(school_id="S1", full_name="Student One", email="s1@test", password_hash="x", role="student"),
                User(school_id="S2", full_name="Student Two", email="s2@test", password_hash="x", role="student"),
                User(school_id="S3", full_name="Student Three", email="s3@test", password_hash="x", role="student"),
                Subject(subject_id="DB", subject_name="Databases", subject_description="DB"),
                TeacherSubject(teacher_id="T1", subject_id="DB", is_active=True),
                CourseClass(class_id=1, class_name="DB-A", subject_id="DB", teacher_id="T1"),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [
                StudentClass(student_id="S1", class_id=1),
                StudentClass(student_id="S2", class_id=1),
                StudentClass(student_id="S3", class_id=1),
                Exam(
                    manage_by="T1",
                    title="Database Systems",
                    examcode="OLD-CODE",
                    max_attempt=1,
                    description="Initial instructions",
                    duration_minutes=60,
                    start_time=now + timedelta(days=1),
                    end_time=now + timedelta(days=1, hours=1),
                    status=ExamStatus.draft,
                    result_visibility="full",
                    subject_id="DB",
                ),
            ]
        )
        self.db.commit()
        self.exam = self.db.query(Exam).one()

    def tearDown(self):
        self.db.close()

    @staticmethod
    def _teacher() -> dict:
        return {"school_id": "T1", "role": "teacher"}

    def _request(self, **overrides) -> TeacherExamRequest:
        values = {
            "title": self.exam.title,
            "examcode": self.exam.examcode,
            "max_attempt": self.exam.max_attempt,
            "description": self.exam.description,
            "duration_minutes": self.exam.duration_minutes,
            "start_time": self.exam.start_time,
            "end_time": self.exam.end_time,
            "status": self.exam.status.value,
            "result_visibility": "full",
            "subject_id": "DB",
        }
        values.update(overrides)
        return TeacherExamRequest(**values)

    def _assign(self, student_ids: list[str]) -> None:
        sync_assignments(
            self.exam.exam_id,
            AssignmentSyncRequest(student_ids=student_ids),
            self._teacher(),
            {},
            self.db,
        )

    def _types_for(self, student_id: str) -> list[NotificationType]:
        return [
            item.type
            for item in self.db.query(Notification)
            .filter(Notification.student_id == student_id)
            .order_by(Notification.notification_id)
            .all()
        ]

    def test_assignment_notifies_only_new_students_and_retries_do_not_duplicate(self):
        self._assign(["S1"])
        self._assign(["S1", "S2", "S3"])
        self._assign(["S1", "S2", "S3"])

        self.assertEqual(self._types_for("S1"), [NotificationType.NEW_EXAM_ASSIGNED])
        self.assertEqual(self._types_for("S2"), [NotificationType.NEW_EXAM_ASSIGNED])
        self.assertEqual(self._types_for("S3"), [NotificationType.NEW_EXAM_ASSIGNED])

    def test_assignment_rollback_leaves_no_orphan_notification(self):
        with patch(
            "src.route.teacherRoute.getExamsRoute.record_audit",
            side_effect=RuntimeError("force rollback"),
        ):
            with self.assertRaises(RuntimeError):
                self._assign(["S1"])

        self.assertEqual(self.db.query(StudentExam).count(), 0)
        self.assertEqual(self.db.query(Notification).count(), 0)

    def test_exam_update_notifies_each_changed_field_only_assigned_students(self):
        self._assign(["S1", "S2"])
        self.db.query(Notification).delete()
        self.db.commit()
        new_start = self.exam.start_time + timedelta(days=2)
        new_end = self.exam.end_time + timedelta(days=2)
        update_exam_in_database(
            self.exam.exam_id,
            self._request(
                start_time=new_start,
                end_time=new_end,
                duration_minutes=90,
                examcode="NEW-CODE",
            ),
            self._teacher(),
            {},
            self.db,
        )

        expected = [
            NotificationType.EXAM_SCHEDULE_CHANGED,
            NotificationType.EXAM_DURATION_CHANGED,
            NotificationType.EXAM_CODE_CHANGED,
        ]
        self.assertEqual(self._types_for("S1"), expected)
        self.assertEqual(self._types_for("S2"), expected)
        self.assertEqual(self._types_for("S3"), [])
        messages = [item.message for item in self.db.query(Notification).all()]
        self.assertTrue(all("OLD-CODE" not in message and "NEW-CODE" not in message for message in messages))

        update_exam_in_database(
            self.exam.exam_id,
            self._request(description="Changed only instructions"),
            self._teacher(),
            {},
            self.db,
        )
        self.assertEqual(self.db.query(Notification).count(), 6)

    def test_cancelled_status_notifies_once_from_draft_or_published(self):
        self._assign(["S1"])
        self.db.query(Notification).delete()
        self.db.commit()

        update_exam_status(
            self.exam.exam_id,
            TeacherExamStatusRequest(status="cancelled"),
            self._teacher(),
            {},
            self.db,
        )
        update_exam_status(
            self.exam.exam_id,
            TeacherExamStatusRequest(status="cancelled"),
            self._teacher(),
            {},
            self.db,
        )

        self.assertEqual(self._types_for("S1"), [NotificationType.EXAM_CANCELLED])
        self.assertEqual(self.db.get(Exam, self.exam.exam_id).status, ExamStatus.cancelled)

        published = Exam(
            manage_by="T1",
            title="Published Exam",
            examcode="PUBLISHED-CODE",
            max_attempt=1,
            description="Published exam",
            duration_minutes=60,
            start_time=datetime(2026, 9, 20, 9, 0),
            end_time=datetime(2026, 9, 20, 10, 0),
            status=ExamStatus.published,
            result_visibility="full",
            subject_id="DB",
        )
        self.db.add(published)
        self.db.flush()
        self.db.add(StudentExam(student_id="S1", exam_id=published.exam_id))
        self.db.commit()
        update_exam_status(
            published.exam_id,
            TeacherExamStatusRequest(status="cancelled"),
            self._teacher(),
            {},
            self.db,
        )
        self.assertEqual(
            self._types_for("S1"),
            [NotificationType.EXAM_CANCELLED, NotificationType.EXAM_CANCELLED],
        )

    def test_lifecycle_events_are_boundary_idempotent_and_cancelled_exams_are_skipped(self):
        self.db.add(StudentExam(student_id="S1", exam_id=self.exam.exam_id))
        self.exam.status = ExamStatus.published
        self.exam.start_time = datetime(2026, 9, 16, 9, 0)
        self.exam.end_time = datetime(2026, 9, 16, 11, 0)
        self.db.commit()

        self.assertEqual(process_due_exam_notifications(self.db, now=datetime(2026, 9, 16, 10, 0)), 1)
        self.db.commit()
        self.assertEqual(process_due_exam_notifications(self.db, now=datetime(2026, 9, 16, 10, 0)), 0)
        self.db.commit()

        self.exam.start_time = datetime(2026, 9, 17, 9, 0)
        self.exam.end_time = datetime(2026, 9, 17, 11, 0)
        self.db.commit()
        self.assertEqual(process_due_exam_notifications(self.db, now=datetime(2026, 9, 17, 10, 0)), 1)
        self.db.commit()

        self.exam.status = ExamStatus.cancelled
        self.exam.end_time = datetime(2026, 9, 17, 10, 30)
        self.db.commit()
        self.assertEqual(process_due_exam_notifications(self.db, now=datetime(2026, 9, 17, 12, 0)), 0)
        self.db.commit()

        self.assertEqual(
            self._types_for("S1"),
            [NotificationType.EXAM_OPENED, NotificationType.EXAM_OPENED],
        )
        self.assertEqual(self.db.query(ExamNotificationLifecycle).count(), 2)

    def test_closed_lifecycle_event_is_emitted_once(self):
        self.db.add(StudentExam(student_id="S1", exam_id=self.exam.exam_id))
        self.exam.status = ExamStatus.published
        self.exam.start_time = datetime(2026, 9, 16, 9, 0)
        self.exam.end_time = datetime(2026, 9, 16, 10, 0)
        self.db.commit()

        self.assertEqual(process_due_exam_notifications(self.db, now=datetime(2026, 9, 16, 11, 0)), 1)
        self.db.commit()
        self.assertEqual(process_due_exam_notifications(self.db, now=datetime(2026, 9, 16, 11, 0)), 0)
        self.db.commit()

        self.assertEqual(self._types_for("S1"), [NotificationType.EXAM_CLOSED])

    def test_cancelled_exam_is_rejected_before_student_access(self):
        with (
            patch("src.controller.teacherController.examController.userModel.getUserBySchoolId", return_value={"school_id": "S1"}),
            patch.object(examModel, "getExamById", return_value={"exam_id": self.exam.exam_id, "status": "cancelled"}),
        ):
            with self.assertRaisesRegex(Exception, "Exam is unavailable"):
                ExamController._validateStudentExamAccess("S1", "student", self.exam.exam_id, None)


if __name__ == "__main__":
    unittest.main()
