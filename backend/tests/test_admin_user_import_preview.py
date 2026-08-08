import unittest
from datetime import date
from io import BytesIO

from fastapi import HTTPException
from openpyxl import Workbook
from sqlalchemy import create_engine, event, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import User, UserRole
from src.route.adminRoute import build_user_import_preview, import_users_from_rows
from src.service.user_import_service import UserImportParseError, parse_user_import_xlsx


HEADERS = ["school_id", "full_name", "email", "role", "phone", "date_of_birth", "initial_password"]


def workbook_bytes(rows, headers=HEADERS):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Users"
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


class AdminUserImportPreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine); Base.metadata.create_all(self.engine)
        self.db = self.Session()

    def tearDown(self): self.db.close()

    def test_valid_dates_and_zero_writes(self):
        rows = parse_user_import_xlsx(workbook_bytes([
            ["S1", "Student", "STUDENT@example.test", "student", None, date(2005, 4, 18), "password123"],
            ["A2", "Admin", "admin2@example.test", "ADMIN", "0123456789", "2000-01-02", "password123"],
        ]))
        before = self.db.query(func.count()).select_from(User).scalar()
        preview = build_user_import_preview(rows, self.db)
        self.assertEqual(self.db.query(func.count()).select_from(User).scalar(), before)
        self.assertEqual(preview["valid_count"], 2)
        self.assertEqual(preview["rows"][0]["date_of_birth"], "2005-04-18")
        self.assertEqual(preview["rows"][1]["warnings"], ["This row will create an administrator account."])
        self.assertNotIn("initial_password", preview["rows"][0])

    def test_duplicates_and_existing_soft_deleted_users_block_rows(self):
        self.db.add(User(school_id="S1", full_name="Deleted", email="deleted@example.test", password_hash="x", role=UserRole.student, deleted_at=date.today()))
        self.db.commit()
        preview = build_user_import_preview(parse_user_import_xlsx(workbook_bytes([
            ["S1", "One", "one@example.test", "student", None, None, "password123"],
            ["S1", "Two", "ONE@example.test", "wrong", "bad", "not-a-date", "short"],
            ["S3", "Three", "one@example.test", "student", None, None, "password123"],
        ])), self.db)
        self.assertEqual(preview["error_count"], 3)
        self.assertIn("School ID is duplicated in the uploaded file", preview["rows"][0]["errors"])
        self.assertIn("School ID already exists", preview["rows"][1]["errors"])
        self.assertIn("Email is duplicated in the uploaded file", preview["rows"][1]["errors"])

    def test_rejects_missing_sheet_header_and_malformed_workbook(self):
        with self.assertRaises(UserImportParseError): parse_user_import_xlsx(b"not an xlsx")
        with self.assertRaises(UserImportParseError): parse_user_import_xlsx(workbook_bytes([], headers=["school_id"]))
        workbook = Workbook(); workbook.active.title = "Other"; output = BytesIO(); workbook.save(output)
        with self.assertRaises(UserImportParseError): parse_user_import_xlsx(output.getvalue())

    def test_import_creates_mixed_users_with_hashed_passwords(self):
        result = import_users_from_rows(parse_user_import_xlsx(workbook_bytes([
            ["S1", "Student", "student@example.test", "student", None, "2005-04-18", "password123"],
            ["T1", "Teacher", "teacher@example.test", "teacher", "0123456789", None, "password456"],
            ["A1", "Admin", "admin@example.test", "admin", None, None, "password789"],
        ])), self.db)
        self.assertEqual(result, {"success": True, "imported_count": 3, "role_counts": {"student": 1, "teacher": 1, "admin": 1}})
        student = self.db.query(User).filter_by(school_id="S1").one()
        self.assertNotEqual(student.password_hash, "password123")
        self.assertEqual(student.date_of_birth, date(2005, 4, 18))

    def test_import_rejects_all_rows_when_one_is_invalid(self):
        rows = parse_user_import_xlsx(workbook_bytes([
            ["S1", "One", "one@example.test", "student", None, None, "password123"],
            ["S2", "Two", "one@example.test", "student", None, None, "password123"],
        ]))
        with self.assertRaises(HTTPException) as raised:
            import_users_from_rows(rows, self.db)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(self.db.query(User).count(), 0)

    def test_database_integrity_error_rolls_back_the_entire_batch(self):
        rows = parse_user_import_xlsx(workbook_bytes([
            [f"S{index}", f"User {index}", f"user{index}@example.test", "student", None, None, "password123"]
            for index in range(1, 11)
        ]))
        original_flush = self.db.flush
        def fail_batch_flush():
            if len(self.db.new) >= 10:
                raise IntegrityError("insert", {}, Exception("forced"))
            return original_flush()
        self.db.flush = fail_batch_flush
        try:
            with self.assertRaises(HTTPException) as raised:
                import_users_from_rows(rows, self.db)
        finally:
            self.db.flush = original_flush
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(self.db.query(User).count(), 0)
