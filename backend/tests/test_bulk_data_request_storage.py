import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import BulkDataRequest, BulkDataRequestStatus, BulkDataRequestType, User, UserRole
from src.service import bulk_data_request_storage as storage


class BulkDataRequestModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.db.add(User(school_id="T1", full_name="Teacher", email="teacher@bulk.test", password_hash="x", role=UserRole.teacher))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_enums_default_to_pending_and_requested_by_uses_school_id(self):
        request = BulkDataRequest(
            request_type=BulkDataRequestType.question_bank,
            requested_by="T1",
            original_filename="questions.docx",
            file_size=1,
            sha256="a" * 64,
        )
        self.db.add(request)
        self.db.commit()

        saved = self.db.get(BulkDataRequest, request.request_id)
        self.assertEqual(saved.status, BulkDataRequestStatus.pending)
        self.assertEqual(saved.requested_by, "T1")
        requested_by_fk = next(fk for fk in BulkDataRequest.__table__.foreign_keys if fk.parent.name == "requested_by")
        self.assertEqual(requested_by_fk.target_fullname, "user.school_id")


class BulkDataRequestStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"BULK_DATA_REQUEST_STORAGE_DIR": self.temp.name}, clear=False)
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.temp.cleanup()

    def test_save_read_sha256_and_delete(self):
        content = b"teacher question import"
        key = storage.save(content, "questions.docx")

        self.assertRegex(key, r"^[0-9a-f-]{36}[.]docx$")
        self.assertEqual(storage.read(key), content)
        self.assertTrue(storage.verify_sha256(key, hashlib.sha256(content).hexdigest()))
        self.assertTrue(storage.delete(key))
        self.assertFalse(storage.exists(key))

    def test_duplicate_original_filenames_receive_separate_uuid_keys(self):
        first = storage.save(b"first", "same-name.xlsx")
        second = storage.save(b"second", "same-name.xlsx")

        self.assertNotEqual(first, second)
        self.assertEqual(storage.read(first), b"first")
        self.assertEqual(storage.read(second), b"second")

    def test_path_traversal_and_absolute_keys_are_rejected(self):
        for key in ("../outside.docx", "C:/outside.docx", "/outside.docx"):
            with self.assertRaisesRegex(ValueError, "Invalid"):
                storage.path_for(key)

    def test_unsupported_suffix_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            storage.save(b"data", "questions.exe")

    def test_relative_environment_path_is_relative_to_backend_root(self):
        with patch.dict(os.environ, {"BULK_DATA_REQUEST_STORAGE_DIR": "generated_bulk_requests"}, clear=False):
            expected = Path(__file__).resolve().parents[1] / "generated_bulk_requests"
            self.assertEqual(storage.storage_root(), expected.resolve())


if __name__ == "__main__":
    unittest.main()
