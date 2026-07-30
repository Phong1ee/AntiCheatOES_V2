import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from werkzeug.security import check_password_hash, generate_password_hash

from database import Base
from src.a_db_config import Subject, TeacherSubject, User, UserRole
from src.controller.authController import AuthController
from src.middleware.authMiddleware import ADMIN_ONLY, verify_token
from src.route.adminRoute import (
    CreateAdminUserPayload,
    ChangeOwnPasswordPayload,
    UpdateAdminUserPayload,
    create_user,
    change_own_password,
    delete_user,
    _ensure_not_last_active_admin,
    get_user_detail,
    list_users,
    lock_user,
    unlock_user,
    update_user,
)


class AdminUserManagementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.admin = self._user("A000001", "Admin One", "admin1@example.edu", UserRole.admin)
        self.second_admin = self._user("A000002", "Admin Two", "admin2@example.edu", UserRole.admin)
        self.teacher = self._user("T000001", "Teacher", "teacher@example.edu", UserRole.teacher)
        self.student = self._user("S000001", "Student", "student@example.edu", UserRole.student)
        self.db.add_all([self.admin, self.second_admin, self.teacher, self.student])
        self.db.commit()
        self.current_admin = {"id": self.admin.id, "school_id": self.admin.school_id, "role": "admin"}

    def tearDown(self):
        self.db.close()

    def _user(self, school_id, full_name, email, role):
        return User(
            school_id=school_id,
            full_name=full_name,
            email=email,
            password_hash=generate_password_hash("password123"),
            role=role,
        )

    def _expect_http_error(self, status_code, callback):
        with self.assertRaises(HTTPException) as raised:
            callback()
        self.assertEqual(raised.exception.status_code, status_code)

    def test_non_admin_is_rejected_and_list_supports_filters_pagination(self):
        self._expect_http_error(403, lambda: ADMIN_ONLY({"role": "teacher"}))
        response = list_users(
            search="example.edu",
            role="student",
            locked=False,
            page=1,
            page_size=1,
            current_user=self.current_admin,
            role_check=None,
            db=self.db,
        )
        self.assertEqual(response["total"], 1)
        self.assertEqual(response["items"][0]["school_id"], self.student.school_id)
        self.assertNotIn("password_hash", response["items"][0])

    def test_create_duplicate_and_detail(self):
        created = create_user(
            CreateAdminUserPayload(
                school_id="S000002",
                full_name="New Student",
                email="new.student@example.edu",
                password="password123",
                role="student",
            ),
            current_user=self.current_admin,
            role_check=None,
            db=self.db,
        )
        stored = self.db.query(User).filter(User.id == created["id"]).one()
        self.assertTrue(check_password_hash(stored.password_hash, "password123"))
        self.assertNotIn("password_hash", created)
        detail = get_user_detail(created["id"], False, self.current_admin, None, self.db)
        self.assertEqual(detail["email"], "new.student@example.edu")
        self._expect_http_error(
            409,
            lambda: create_user(
                CreateAdminUserPayload(
                    school_id="S000002",
                    full_name="Duplicate",
                    email="duplicate@example.edu",
                    password="password123",
                    role="student",
                ),
                self.current_admin,
                None,
                self.db,
            ),
        )

    def test_edit_deactivates_teacher_permissions_when_role_changes(self):
        subject = Subject(subject_id="MATH", subject_name="Math", subject_description="Math subject")
        self.db.add(subject)
        self.db.flush()
        self.db.add(TeacherSubject(teacher_id=self.teacher.school_id, subject_id=subject.subject_id, is_active=True))
        self.db.commit()
        update_user(
            self.teacher.id,
            UpdateAdminUserPayload(full_name="Former Teacher", role="student"),
            self.current_admin,
            None,
            self.db,
        )
        self.db.refresh(self.teacher)
        permission = self.db.query(TeacherSubject).one()
        self.assertEqual(self.teacher.role, UserRole.student)
        self.assertFalse(permission.is_active)

    def test_admin_cannot_change_another_users_password(self):
        old_hash = self.teacher.password_hash
        self._expect_http_error(
            403,
            lambda: update_user(
                self.teacher.id,
                UpdateAdminUserPayload(full_name="Should Not Save", password="newpassword123"),
                self.current_admin,
                None,
                self.db,
            ),
        )
        self.db.refresh(self.teacher)
        self.assertEqual(self.teacher.password_hash, old_hash)
        self.assertEqual(self.teacher.full_name, "Teacher")

    def test_admin_cannot_demote_or_change_school_id_of_own_account(self):
        original_school_id = self.admin.school_id
        update_user(
            self.admin.id,
            UpdateAdminUserPayload(full_name="Updated Admin", email="updated.admin@example.edu", phone="0123456789"),
            self.current_admin,
            None,
            self.db,
        )
        self.db.refresh(self.admin)
        self.assertEqual(self.admin.full_name, "Updated Admin")
        self.assertEqual(self.admin.role, UserRole.admin)
        self.assertEqual(self.admin.school_id, original_school_id)
        self._expect_http_error(
            409,
            lambda: update_user(self.admin.id, UpdateAdminUserPayload(role="student"), self.current_admin, None, self.db),
        )
        self._expect_http_error(
            409,
            lambda: update_user(self.admin.id, UpdateAdminUserPayload(school_id="A999999"), self.current_admin, None, self.db),
        )
        self.db.refresh(self.admin)
        self.assertEqual(self.admin.role, UserRole.admin)
        self.assertEqual(self.admin.school_id, original_school_id)

    def test_admin_can_change_own_password_with_confirmation(self):
        old_hash = self.admin.password_hash
        response = change_own_password(
            ChangeOwnPasswordPayload(
                current_password="password123",
                new_password="newpassword123",
                confirm_password="newpassword123",
            ),
            self.current_admin,
            None,
            self.db,
        )
        self.db.refresh(self.admin)
        self.assertTrue(response["success"])
        self.assertNotIn("password_hash", response)
        self.assertNotEqual(self.admin.password_hash, old_hash)
        self.assertTrue(check_password_hash(self.admin.password_hash, "newpassword123"))
        self.assertFalse(check_password_hash(self.admin.password_hash, "password123"))

    def test_change_own_password_rejects_bad_current_or_confirmation(self):
        old_hash = self.admin.password_hash
        self._expect_http_error(
            400,
            lambda: change_own_password(
                ChangeOwnPasswordPayload(
                    current_password="wrongpassword",
                    new_password="newpassword123",
                    confirm_password="newpassword123",
                ),
                self.current_admin,
                None,
                self.db,
            ),
        )
        self._expect_http_error(
            400,
            lambda: change_own_password(
                ChangeOwnPasswordPayload(
                    current_password="password123",
                    new_password="newpassword123",
                    confirm_password="differentpassword",
                ),
                self.current_admin,
                None,
                self.db,
            ),
        )
        self.db.refresh(self.admin)
        self.assertEqual(self.admin.password_hash, old_hash)

    def test_lock_unlock_and_old_token_enforcement(self):
        token = AuthController.create_token(self.student.school_id, "student")
        verified = verify_token(authorization=f"Bearer {token}", db=self.db)
        self.assertEqual(verified["id"], self.student.id)
        locked = lock_user(self.student.id, self.current_admin, None, self.db)
        self.assertTrue(locked["is_locked"])
        self._expect_http_error(401, lambda: verify_token(authorization=f"Bearer {token}", db=self.db))
        unlocked = unlock_user(self.student.id, self.current_admin, None, self.db)
        self.assertFalse(unlocked["is_locked"])
        self.assertEqual(verify_token(authorization=f"Bearer {token}", db=self.db)["role"], "student")

    def test_soft_delete_deactivates_teacher_permissions_and_blocks_old_token(self):
        subject = Subject(subject_id="PHY", subject_name="Physics", subject_description="Physics subject")
        self.db.add(subject)
        self.db.flush()
        self.db.add(TeacherSubject(teacher_id=self.teacher.school_id, subject_id=subject.subject_id, is_active=True))
        self.db.commit()
        token = AuthController.create_token(self.teacher.school_id, "teacher")
        delete_user(self.teacher.id, self.current_admin, None, self.db)
        self.db.refresh(self.teacher)
        self.assertIsNotNone(self.teacher.deleted_at)
        self.assertTrue(self.teacher.is_locked)
        self.assertFalse(self.db.query(TeacherSubject).one().is_active)
        self.assertEqual(self.db.query(User).filter(User.id == self.teacher.id).count(), 1)
        self._expect_http_error(401, lambda: verify_token(authorization=f"Bearer {token}", db=self.db))
        active = list_users(current_user=self.current_admin, role_check=None, db=self.db)
        self.assertNotIn(self.teacher.id, [item["id"] for item in active["items"]])

    def test_cannot_self_manage_or_remove_last_active_admin(self):
        self._expect_http_error(409, lambda: lock_user(self.admin.id, self.current_admin, None, self.db))
        self.db.refresh(self.admin)
        self.assertFalse(self.admin.is_locked)
        self.assertIsNone(self.admin.locked_at)
        self.assertIsNone(self.admin.locked_by)
        self._expect_http_error(409, lambda: delete_user(self.admin.id, self.current_admin, None, self.db))
        self.db.refresh(self.admin)
        self.assertIsNone(self.admin.deleted_at)
        self.assertIsNone(self.admin.deleted_by)
        lock_user(self.second_admin.id, self.current_admin, None, self.db)
        self._expect_http_error(409, lambda: _ensure_not_last_active_admin(self.db, self.admin))
        self.db.refresh(self.admin)
        self.assertFalse(self.admin.is_locked)
        self.assertIsNone(self.admin.deleted_at)


if __name__ == "__main__":
    unittest.main()
