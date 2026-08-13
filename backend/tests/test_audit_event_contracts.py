import unittest
from datetime import datetime
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from werkzeug.security import generate_password_hash

from database import Base
from src.a_db_config import AuditLog, Exam, Subject, TeacherSubject, User, UserRole
from src.models.teacher.requestModel.TeacherExamRequest import TeacherExamRequest
from src.route.adminRoute import lock_user
from src.route.teacherRoute.addExamRoute import update_exam_in_database
from src.service.audit_service import record_audit
from src.service.cache_invalidation_contract import (
    admin_enrollment_updated,
    admin_permission_updated,
    teacher_assignment_changed,
    teacher_exam_updated,
    teacher_grading_finalized,
)
from src.service.event_contract import build_event_envelope


class AuditAndEventContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.admin = self._user("A1", "Admin", "admin@audit.test", UserRole.admin)
        self.teacher = self._user("T1", "Teacher", "teacher@audit.test", UserRole.teacher)
        self.other_teacher = self._user("T2", "Other", "other@audit.test", UserRole.teacher)
        self.student = self._user("S1", "Student", "student@audit.test", UserRole.student)
        self.db.add_all([
            self.admin,
            self.teacher,
            self.other_teacher,
            self.student,
            Subject(subject_id="DB", subject_name="Databases", subject_description="DB"),
        ])
        self.db.flush()
        self.db.add(TeacherSubject(teacher_id="T1", subject_id="DB", is_active=True, assigned_by="A1"))
        self.exam = Exam(
            manage_by="T1", title="Audit exam", examcode="AUDIT-EXAM", max_attempt=1,
            duration_minutes=30, subject_id="DB",
        )
        self.db.add(self.exam)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    @staticmethod
    def _user(school_id, full_name, email, role):
        return User(
            school_id=school_id,
            full_name=full_name,
            email=email,
            password_hash=generate_password_hash("password123"),
            role=role,
        )

    def _exam_request(self):
        return TeacherExamRequest(
            title="Changed audit exam", examcode="AUDIT-EXAM", max_attempt=1,
            description="Changed", duration_minutes=30,
            start_time=datetime(2026, 9, 1, 8, 0),
            end_time=datetime(2026, 9, 1, 8, 30),
            subject_id="DB",
            result_visibility="hidden", expected_version=self.exam.version,
        )

    def test_audit_is_transaction_bound_and_sanitizes_sensitive_metadata(self):
        record_audit(
            self.db,
            actor_school_id="A1",
            actor_role=UserRole.admin,
            action="USER_LOCKED",
            entity_type="user",
            entity_id=self.student.id,
            metadata={"target_school_id": "S1", "password": "secret", "nested": {"jwt": "x", "ok": True}},
        )
        self.db.commit()

        audit = self.db.query(AuditLog).one()
        self.assertEqual((audit.actor_school_id, audit.actor_role, audit.action), ("A1", "admin", "USER_LOCKED"))
        self.assertEqual(audit.metadata_json, {"target_school_id": "S1", "nested": {"ok": True}})

        record_audit(self.db, actor_school_id="A1", actor_role="admin", action="USER_DELETED", entity_type="user", entity_id=self.student.id)
        self.db.rollback()
        self.assertEqual(self.db.query(AuditLog).count(), 1)

    def test_mutation_failure_rolls_back_its_audit_row(self):
        with patch.object(self.db, "commit", side_effect=RuntimeError("database unavailable")):
            with self.assertRaisesRegex(RuntimeError, "database unavailable"):
                lock_user(self.student.id, {"school_id": "A1", "role": "admin"}, None, self.db)

        self.db.expire_all()
        self.assertFalse(self.db.get(User, self.student.id).is_locked)
        self.assertEqual(self.db.query(AuditLog).count(), 0)

    def test_teacher_ownership_is_enforced_before_audit_or_mutation(self):
        with self.assertRaises(HTTPException) as error:
            update_exam_in_database(
                self.exam.exam_id,
                self._exam_request(),
                {"school_id": "T2", "role": "teacher"},
                None,
                self.db,
            )

        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(self.db.get(Exam, self.exam.exam_id).title, "Audit exam")
        self.assertEqual(self.db.query(AuditLog).count(), 0)

    def test_event_and_invalidation_contracts_are_safe_and_complete(self):
        envelope = build_event_envelope(
            event_type="exam.updated",
            aggregate_type="exam",
            aggregate_id=self.exam.exam_id,
            metadata={"password": "secret", "answer_payload": "full answer", "title": "safe"},
        )
        self.assertEqual(set(envelope), {"event_id", "event_type", "aggregate_type", "aggregate_id", "occurred_at", "version", "metadata"})
        self.assertEqual(envelope["metadata"], {"title": "safe"})
        self.assertEqual(teacher_exam_updated(1).scope, "teacher_exam")
        self.assertEqual(teacher_assignment_changed(1).scope, "teacher_assignment")
        self.assertEqual(admin_permission_updated("T1").scope, "admin_permission")
        self.assertEqual(admin_enrollment_updated(1).scope, "admin_enrollment")
        self.assertEqual(teacher_grading_finalized(1).scope, "teacher_grading")


if __name__ == "__main__":
    unittest.main()
