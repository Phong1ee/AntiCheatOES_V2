import unittest
from datetime import datetime
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import (
    Attempt,
    CourseClass,
    Exam,
    StudentClass,
    StudentExam,
    Subject,
    TeacherSubject,
    User,
)
from src.route.teacherRoute.getExamsRoute import (
    AssignmentSyncRequest,
    get_assignment_options,
    sync_assignments,
)
from src.controller.teacherController.examController import ExamController
from src.models.teacher import examModel


class ExamAssignmentTests(unittest.TestCase):
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
        self.db.add_all(
            [
                User(school_id="T1", full_name="Teacher One", email="t1@test", password_hash="x", role="teacher"),
                User(school_id="T2", full_name="Teacher Two", email="t2@test", password_hash="x", role="teacher"),
                User(school_id="S1", full_name="Student One", email="s1@test", password_hash="x", role="student"),
                User(school_id="S2", full_name="Student Two", email="s2@test", password_hash="x", role="student"),
                User(school_id="S3", full_name="Student Three", email="s3@test", password_hash="x", role="student"),
                Subject(subject_id="DB", subject_name="Databases", subject_description="DB"),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [
                CourseClass(class_id=1, class_name="DB-A", subject_id="DB", teacher_id="T1"),
                CourseClass(class_id=2, class_name="DB-B", subject_id="DB", teacher_id="T1"),
                CourseClass(class_id=3, class_name="Other", subject_id="DB", teacher_id="T2"),
                TeacherSubject(teacher_id="T1", subject_id="DB", is_active=True),
                TeacherSubject(teacher_id="T2", subject_id="DB", is_active=True),
                Exam(manage_by="T1", title="Exam", examcode="E1", subject_id="DB", total_points=10),
                Exam(manage_by="T2", title="Other exam", examcode="E2", subject_id="DB", total_points=10),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [
                StudentClass(student_id="S1", class_id=1),
                StudentClass(student_id="S1", class_id=2),
                StudentClass(student_id="S2", class_id=2),
                StudentClass(student_id="S3", class_id=3),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_options_are_owned_and_students_are_deduplicated(self):
        exam = self.db.query(Exam).filter_by(manage_by="T1").one()
        result = get_assignment_options(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual({item["class_id"] for item in result["classes"]}, {1, 2})
        self.assertEqual({item["school_id"] for item in result["students"]}, {"S1", "S2"})
        s1 = next(item for item in result["students"] if item["school_id"] == "S1")
        self.assertEqual(set(s1["class_ids"]), {1, 2})

    def test_class_expansion_individual_sync_idempotency_and_authorization(self):
        exam = self.db.query(Exam).filter_by(manage_by="T1").one()
        first = sync_assignments(
            exam.exam_id,
            AssignmentSyncRequest(class_ids=[2]),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual((first["added_count"], first["final_count"]), (2, 2))
        second = sync_assignments(
            exam.exam_id,
            AssignmentSyncRequest(student_ids=["S1", "S2"]),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual((second["added_count"], second["unchanged_count"]), (0, 2))
        self.assertEqual(
            {row.student_id for row in self.db.query(StudentExam).filter_by(exam_id=exam.exam_id)},
            {"S1", "S2"},
        )
        with self.assertRaises(HTTPException) as foreign_class:
            sync_assignments(
                exam.exam_id,
                AssignmentSyncRequest(class_ids=[3]),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(foreign_class.exception.status_code, 403)
        with self.assertRaises(HTTPException) as invalid_student:
            sync_assignments(
                exam.exam_id,
                AssignmentSyncRequest(student_ids=["S3"]),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(invalid_student.exception.status_code, 422)

    def test_options_and_sync_are_scoped_to_the_exams_subject(self):
        exam = self.db.query(Exam).filter_by(manage_by="T1").one()
        self.db.add_all(
            [
                User(school_id="S4", full_name="Student Four", email="s4@test", password_hash="x", role="student"),
                Subject(subject_id="WEB", subject_name="Web", subject_description="WEB"),
            ]
        )
        self.db.flush()
        self.db.add(CourseClass(class_id=4, class_name="WEB-A", subject_id="WEB", teacher_id="T1"))
        self.db.flush()
        self.db.add(StudentClass(student_id="S4", class_id=4))
        self.db.commit()

        result = get_assignment_options(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual({item["class_id"] for item in result["classes"]}, {1, 2})
        self.assertEqual({item["school_id"] for item in result["students"]}, {"S1", "S2"})

        with self.assertRaises(HTTPException) as wrong_subject_class:
            sync_assignments(
                exam.exam_id,
                AssignmentSyncRequest(class_ids=[4]),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(wrong_subject_class.exception.status_code, 403)
        with self.assertRaises(HTTPException) as wrong_subject_student:
            sync_assignments(
                exam.exam_id,
                AssignmentSyncRequest(student_ids=["S4"]),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(wrong_subject_student.exception.status_code, 422)

    def test_attempt_blocks_removal_without_deleting_history(self):
        exam = self.db.query(Exam).filter_by(manage_by="T1").one()
        self.db.add(StudentExam(exam_id=exam.exam_id, student_id="S1"))
        self.db.add(Attempt(exam_id=exam.exam_id, student_id="S1", attempt_no=1))
        self.db.commit()
        with self.assertRaises(HTTPException) as conflict:
            sync_assignments(
                exam.exam_id,
                AssignmentSyncRequest(),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(conflict.exception.status_code, 409)
        self.assertIsNotNone(self.db.query(Attempt).filter_by(student_id="S1").first())
        self.assertIsNotNone(self.db.query(StudentExam).filter_by(student_id="S1").first())

    def test_database_composite_key_prevents_duplicate_assignment_mapping(self):
        exam = self.db.query(Exam).filter_by(manage_by="T1").one()
        self.db.add(StudentExam(exam_id=exam.exam_id, student_id="S1"))
        self.db.commit()

        self.db.add(StudentExam(exam_id=exam.exam_id, student_id="S1"))
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

        self.assertEqual(
            self.db.query(StudentExam).filter_by(exam_id=exam.exam_id, student_id="S1").count(),
            1,
        )

    def test_student_class_composite_key_prevents_duplicate_enrollment(self):
        self.db.add(StudentClass(student_id="S1", class_id=1))
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

        self.assertEqual(
            self.db.query(StudentClass).filter_by(student_id="S1", class_id=1).count(),
            1,
        )

    def test_concurrent_assignment_requests_leave_one_mapping(self):
        exam = self.db.query(Exam).filter_by(manage_by="T1").one()
        first_db = self.Session()
        second_db = self.Session()
        try:
            first = sync_assignments(
                exam.exam_id,
                AssignmentSyncRequest(student_ids=["S1"], expected_version=1),
                {"school_id": "T1"},
                {},
                first_db,
            )
            with self.assertRaises(HTTPException) as stale:
                sync_assignments(
                    exam.exam_id,
                    AssignmentSyncRequest(student_ids=["S1"], expected_version=1),
                    {"school_id": "T1"},
                    {},
                    second_db,
                )

            self.assertEqual(first["added_count"], 1)
            self.assertEqual(stale.exception.status_code, 409)
        finally:
            first_db.close()
            second_db.close()

        self.assertEqual(
            self.db.query(StudentExam).filter_by(exam_id=exam.exam_id, student_id="S1").count(),
            1,
        )

    def test_successful_assignment_is_visible_in_the_student_exam_list(self):
        exam = self.db.query(Exam).filter_by(manage_by="T1").one()
        sync_assignments(
            exam.exam_id,
            AssignmentSyncRequest(student_ids=["S1"]),
            {"school_id": "T1"},
            {},
            self.db,
        )
        assigned_ids = [
            row.exam_id for row in self.db.query(StudentExam).filter_by(student_id="S1").all()
        ]
        with (
            patch.object(examModel, "getStudentExams", return_value=[{"exam_id": exam_id} for exam_id in assigned_ids]),
            patch.object(examModel, "get_database_now") as database_now,
        ):
            database_now.return_value = datetime(2026, 8, 12, 10, 0)
            result = ExamController.getStudentExams("S1", "student")

        self.assertEqual([item["exam_id"] for item in result["exams"]], [exam.exam_id])


if __name__ == "__main__":
    unittest.main()
