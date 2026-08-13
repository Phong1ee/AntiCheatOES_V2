import unittest
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import CourseClass, Exam, StudentClass, Subject, TeacherSubject, User
from src.models.teacher.requestModel.TeacherExamRequest import TeacherExamRequest
from src.route.teacherRoute.addExamRoute import update_exam_in_database
from src.route.teacherRoute.getExamsRoute import AssignmentSyncRequest, sync_assignments


class TeacherExamOptimisticLockingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.db.add_all(
            [
                User(school_id="T1", full_name="Teacher", email="teacher@test", password_hash="x", role="teacher"),
                User(school_id="S1", full_name="Student", email="student@test", password_hash="x", role="student"),
                Subject(subject_id="DB", subject_name="Databases", subject_description="DB"),
                Subject(subject_id="WEB", subject_name="Web", subject_description="WEB"),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [
                TeacherSubject(teacher_id="T1", subject_id="DB", is_active=True),
                TeacherSubject(teacher_id="T1", subject_id="WEB", is_active=False),
                CourseClass(class_id=1, class_name="DB-A", subject_id="DB", teacher_id="T1"),
                StudentClass(student_id="S1", class_id=1),
                Exam(manage_by="T1", title="Original", examcode="LOCK", subject_id="DB", duration_minutes=60, max_attempt=1),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _request(self, title: str, *, subject_id: str = "DB", expected_version: int = 1) -> TeacherExamRequest:
        return TeacherExamRequest(
            title=title,
            examcode="LOCK",
            max_attempt=1,
            description="Atomic save test",
            duration_minutes=60,
            start_time=datetime(2026, 9, 1, 8, 0),
            end_time=datetime(2026, 9, 1, 9, 0),
            status="draft",
            result_visibility="hidden",
            subject_id=subject_id,
            expected_version=expected_version,
        )

    def test_same_version_first_save_wins_and_second_is_conflict(self):
        exam = self.db.query(Exam).one()
        first = update_exam_in_database(exam.exam_id, self._request("First"), {"school_id": "T1"}, {}, self.db)
        self.assertEqual(first["version"], 2)

        with self.assertRaises(HTTPException) as stale:
            update_exam_in_database(exam.exam_id, self._request("Second"), {"school_id": "T1"}, {}, self.db)
        self.assertEqual(stale.exception.status_code, 409)
        self.db.expire_all()
        persisted = self.db.get(Exam, exam.exam_id)
        self.assertEqual((persisted.title, persisted.version), ("First", 2))

    def test_assignment_mapping_failure_rolls_back_exam_version_and_rows(self):
        exam = self.db.query(Exam).one()
        with self.assertRaises(HTTPException) as invalid:
            sync_assignments(
                exam.exam_id,
                AssignmentSyncRequest(student_ids=["NOT-IN-ROSTER"], expected_version=1),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(invalid.exception.status_code, 422)
        self.db.expire_all()
        self.assertEqual(self.db.get(Exam, exam.exam_id).version, 1)
        self.assertEqual(self.db.query(StudentClass).count(), 1)

    def test_revoked_subject_permission_returns_403_without_mutation(self):
        exam = self.db.query(Exam).one()
        with self.assertRaises(HTTPException) as forbidden:
            update_exam_in_database(
                exam.exam_id,
                self._request("Should not persist", subject_id="WEB"),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(forbidden.exception.status_code, 403)
        self.db.expire_all()
        persisted = self.db.get(Exam, exam.exam_id)
        self.assertEqual((persisted.title, persisted.subject_id, persisted.version), ("Original", "DB", 1))

    def test_current_subject_revoke_blocks_stale_teacher_session_without_mutation(self):
        """A token created before revoke cannot mutate the owned DB exam."""
        exam = self.db.query(Exam).one()
        current_teacher = {"school_id": "T1", "role": "teacher"}
        self.db.query(TeacherSubject).filter_by(teacher_id="T1", subject_id="DB").update({"is_active": False})
        self.db.commit()

        with self.assertRaises(HTTPException) as forbidden:
            update_exam_in_database(exam.exam_id, self._request("Revoked"), current_teacher, {}, self.db)

        self.assertEqual(forbidden.exception.status_code, 403)
        self.db.expire_all()
        persisted = self.db.get(Exam, exam.exam_id)
        self.assertEqual((persisted.title, persisted.version), ("Original", 1))

    def test_teacher_without_current_subject_permission_cannot_update_owned_exam(self):
        exam = self.db.query(Exam).one()
        self.db.add(User(school_id="T2", full_name="Other", email="other@test", password_hash="x", role="teacher"))
        self.db.flush()
        # Ownership is deliberately assigned here to isolate subject authorization.
        exam.manage_by = "T2"
        self.db.commit()

        with self.assertRaises(HTTPException) as forbidden:
            update_exam_in_database(exam.exam_id, self._request("Other"), {"school_id": "T2"}, {}, self.db)

        self.assertEqual(forbidden.exception.status_code, 403)
        self.db.expire_all()
        persisted = self.db.get(Exam, exam.exam_id)
        self.assertEqual((persisted.title, persisted.version), ("Original", 1))


if __name__ == "__main__":
    unittest.main()
