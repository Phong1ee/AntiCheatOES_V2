import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from werkzeug.security import generate_password_hash

from database import Base
from src.a_db_config import AuditLog, CourseClass, OutboxEvent, StudentClass, Subject, TeacherSubject, User, UserRole
from src.route.adminRoute import (
    ClassStudentsPayload,
    CreateClassPayload,
    add_class_students,
    create_class,
)


class AdminClassManagementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.admin = self._user("A1", "Admin", "admin@example.edu", UserRole.admin)
        self.teacher = self._user("T1", "Teacher", "teacher@example.edu", UserRole.teacher)
        self.student_one = self._user("S1", "Student One", "s1@example.edu", UserRole.student)
        self.student_two = self._user("S2", "Student Two", "s2@example.edu", UserRole.student)
        self.db.add_all([
            self.admin, self.teacher, self.student_one, self.student_two,
            Subject(subject_id="DB", subject_name="Databases", subject_description="DB"),
        ])
        self.db.commit()
        self.current_admin = {"id": "A1", "school_id": "A1", "role": "admin"}

    def tearDown(self):
        self.db.close()

    @staticmethod
    def _user(school_id, full_name, email, role):
        return User(
            school_id=school_id, full_name=full_name, email=email,
            password_hash=generate_password_hash("password123"), role=role,
        )

    def _create_class(self, name="DB-A"):
        return create_class(
            CreateClassPayload(class_name=name, subject_id="DB", teacher_school_id="T1"),
            self.current_admin, None, self.db,
        )

    def test_create_class_is_atomic_and_records_permission_side_effects(self):
        with patch("src.route.adminRoute.deliver_invalidation") as invalidation:
            created = self._create_class()

        self.assertEqual(created["class_name"], "DB-A")
        permission = self.db.query(TeacherSubject).filter_by(teacher_id="T1", subject_id="DB").one()
        self.assertTrue(permission.is_active)
        actions = {row.action for row in self.db.query(AuditLog).all()}
        self.assertEqual(actions, {"CLASS_CREATED", "TEACHER_PERMISSION_UPDATED"})
        self.assertEqual(self.db.query(OutboxEvent).filter_by(event_type="analytics.permission_updated").count(), 1)
        invalidation.assert_called_once()

    def test_duplicate_subject_class_name_is_rejected(self):
        self._create_class()
        with self.assertRaises(HTTPException) as error:
            self._create_class()
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.query(CourseClass).count(), 1)

    def test_failed_commit_rolls_back_class_permission_audit_and_outbox(self):
        with patch.object(self.db, "commit", side_effect=RuntimeError("simulated write failure")):
            with self.assertRaisesRegex(RuntimeError, "write failure"):
                self._create_class()

        self.db.expire_all()
        self.assertEqual(self.db.query(CourseClass).count(), 0)
        self.assertEqual(self.db.query(TeacherSubject).count(), 0)
        self.assertEqual(self.db.query(AuditLog).count(), 0)
        self.assertEqual(self.db.query(OutboxEvent).count(), 0)

    def test_enrollment_conflict_rolls_back_entire_request_and_audits_success(self):
        first = self._create_class("DB-A")
        second = self._create_class("DB-B")
        first_id, second_id = first["class_id"], second["class_id"]
        add_class_students(first_id, ClassStudentsPayload(student_ids=["S1"]), self.current_admin, None, self.db)

        with self.assertRaises(HTTPException) as error:
            add_class_students(second_id, ClassStudentsPayload(student_ids=["S1", "S2"]), self.current_admin, None, self.db)
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.query(StudentClass).filter_by(class_id=second_id).count(), 0)
        self.assertEqual(self.db.query(StudentClass).filter_by(class_id=first_id).count(), 1)
        roster_audits = self.db.query(AuditLog).filter_by(action="CLASS_ROSTER_UPDATED").all()
        self.assertEqual(len(roster_audits), 1)
