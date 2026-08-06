import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from werkzeug.security import generate_password_hash

from database import Base
from src.a_db_config import Subject, TeacherSubject, User, UserRole
from src.route.adminRoute import (
    ReplaceTeacherPermissionsPayload,
    TeacherPermissionPayload,
    grant_teacher_permission,
    list_teacher_permissions,
    revoke_teacher_permission,
    replace_teacher_permissions,
)


class TeacherPermissionTests(unittest.TestCase):
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
        self.student = self._user("S1", "Student", "student@example.edu", UserRole.student)
        self.db.add_all([self.admin, self.teacher, self.student, Subject(subject_id="DB", subject_name="Databases", subject_description="DB")])
        self.db.commit()
        self.current_admin = {"id": self.admin.school_id, "school_id": self.admin.school_id, "role": "admin"}

    def tearDown(self):
        self.db.close()

    def _user(self, school_id, full_name, email, role):
        return User(school_id=school_id, full_name=full_name, email=email, password_hash=generate_password_hash("password123"), role=role)

    def _raises(self, code, callback):
        with self.assertRaises(HTTPException) as error:
            callback()
        self.assertEqual(error.exception.status_code, code)

    def test_grant_list_revoke_and_reactivate(self):
        created = grant_teacher_permission(TeacherPermissionPayload(teacher_school_id=self.teacher.school_id, subject_id="DB"), self.current_admin, None, self.db)
        self.assertTrue(created["is_active"])
        self.assertEqual(created["assigned_by"], self.admin.school_id)
        listed = list_teacher_permissions(current_user=self.current_admin, role_check=None, db=self.db)
        self.assertEqual(len(listed["items"]), 1)
        self.assertNotIn("password_hash", listed["items"][0])
        revoked = revoke_teacher_permission(self.teacher.school_id, "DB", self.current_admin, None, self.db)
        self.assertFalse(revoked["is_active"])
        reactivated = grant_teacher_permission(TeacherPermissionPayload(teacher_school_id=self.teacher.school_id, subject_id="DB"), self.current_admin, None, self.db)
        self.assertTrue(reactivated["is_active"])
        self.assertEqual(self.db.query(TeacherSubject).count(), 1)

    def test_invalid_teacher_and_duplicate_active_permission_are_rejected(self):
        self._raises(400, lambda: grant_teacher_permission(TeacherPermissionPayload(teacher_school_id=self.student.school_id, subject_id="DB"), self.current_admin, None, self.db))
        grant_teacher_permission(TeacherPermissionPayload(teacher_school_id=self.teacher.school_id, subject_id="DB"), self.current_admin, None, self.db)
        self._raises(409, lambda: grant_teacher_permission(TeacherPermissionPayload(teacher_school_id=self.teacher.school_id, subject_id="DB"), self.current_admin, None, self.db))

    def test_atomic_replace_reactivates_and_rolls_back_invalid_subjects(self):
        self.db.add(Subject(subject_id="WEB", subject_name="Web", subject_description="Web"))
        self.db.commit()
        replace_teacher_permissions(self.teacher.school_id, ReplaceTeacherPermissionsPayload(subject_ids=["DB", "WEB"]), self.current_admin, None, self.db)
        replace_teacher_permissions(self.teacher.school_id, ReplaceTeacherPermissionsPayload(subject_ids=["DB"]), self.current_admin, None, self.db)
        self.assertFalse(self.db.query(TeacherSubject).filter_by(teacher_id=self.teacher.school_id, subject_id="WEB").one().is_active)
        self._raises(404, lambda: replace_teacher_permissions(self.teacher.school_id, ReplaceTeacherPermissionsPayload(subject_ids=["DB", "INVALID"]), self.current_admin, None, self.db))
        active = {item.subject_id for item in self.db.query(TeacherSubject).filter_by(teacher_id=self.teacher.school_id, is_active=True).all()}
        self.assertEqual(active, {"DB"})
        removed = replace_teacher_permissions(self.teacher.school_id, ReplaceTeacherPermissionsPayload(subject_ids=[]), self.current_admin, None, self.db)
        self.assertEqual(removed["permissions"], [])
        self.assertEqual(self.db.query(User).filter_by(school_id=self.teacher.school_id).count(), 1)
