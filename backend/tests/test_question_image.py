"""Storing a question image as a MEDIUMBLOB.

The blob is deferred so the many queries that read Question rows never carry it,
and the mime column is what tells a caller an image exists.
"""

import unittest

from sqlalchemy import create_engine, inspect
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Session, undefer
from sqlalchemy.schema import CreateTable

from src.a_db_config import Base, Question, Subject, User, UserRole
from src.route.teacherRoute.questionImageRoute import (
    ALLOWED_IMAGE_TYPES,
    MAX_IMAGE_SIZE,
    _sniff_image_type,
)


PNG = b"\x89PNG\r\n\x1a\n" + b"payload-bytes"
JPEG = b"\xff\xd8\xff" + b"payload-bytes"
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"payload"


class QuestionImageStorageTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(Subject(subject_id="NET204", subject_name="N", subject_description="d"))
        self.db.add(User(
            school_id="T1", full_name="T", email="t@example.edu",
            password_hash="x", role=UserRole.teacher,
        ))
        self.question = Question(
            question_text="What does this diagram show?", question_type="MCQ",
            question_difficulties="easy", subject_id="NET204",
            created_by="T1", question_status="draft",
        )
        self.db.add(self.question)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_column_is_mediumblob_on_mysql(self):
        ddl = CreateTable(Question.__table__).compile(dialect=mysql.dialect()).string
        self.assertIn("question_image MEDIUMBLOB", ddl)
        self.assertIn("question_image_mime VARCHAR(100)", ddl)

    def test_bytes_round_trip(self):
        self.question.question_image = PNG
        self.question.question_image_mime = "image/png"
        self.db.commit()
        self.db.expire_all()

        stored = self.db.query(Question).options(undefer(Question.question_image)).one()

        self.assertEqual(stored.question_image, PNG)
        self.assertEqual(stored.question_image_mime, "image/png")

    def test_blob_is_not_loaded_by_an_ordinary_query(self):
        self.question.question_image = PNG
        self.question.question_image_mime = "image/png"
        self.db.commit()
        self.db.expire_all()

        loaded = self.db.query(Question).one()

        # The flag is there, the megabytes are not - until something asks.
        self.assertEqual(loaded.question_image_mime, "image/png")
        self.assertIn("question_image", inspect(loaded).unloaded)

    def test_removing_an_image_clears_both_columns(self):
        self.question.question_image = PNG
        self.question.question_image_mime = "image/png"
        self.db.commit()

        self.question.question_image = None
        self.question.question_image_mime = None
        self.db.commit()
        self.db.expire_all()

        stored = self.db.query(Question).options(undefer(Question.question_image)).one()
        self.assertIsNone(stored.question_image)
        self.assertIsNone(stored.question_image_mime)

    def test_a_question_without_an_image_reports_none(self):
        loaded = self.db.query(Question).one()
        self.assertIsNone(loaded.question_image_mime)


class ImageTypeSniffingTests(unittest.TestCase):
    def test_recognises_the_supported_formats(self):
        self.assertEqual(_sniff_image_type(PNG), "image/png")
        self.assertEqual(_sniff_image_type(JPEG), "image/jpeg")
        self.assertEqual(_sniff_image_type(WEBP), "image/webp")
        self.assertEqual(_sniff_image_type(b"GIF89a...."), "image/gif")

    def test_rejects_content_that_is_not_an_image(self):
        # A caller-supplied content type is a claim; these bytes get served back
        # to other users, so the file's own header is what decides.
        self.assertIsNone(_sniff_image_type(b"<svg onload=alert(1)>"))
        self.assertIsNone(_sniff_image_type(b"%PDF-1.7"))
        self.assertIsNone(_sniff_image_type(b"MZ\x90\x00"))
        self.assertIsNone(_sniff_image_type(b""))

    def test_every_sniffed_type_is_an_allowed_type(self):
        for sample in (PNG, JPEG, WEBP, b"GIF89a"):
            self.assertIn(_sniff_image_type(sample), ALLOWED_IMAGE_TYPES)

    def test_upload_cap_stays_well_inside_mediumblob(self):
        self.assertLess(MAX_IMAGE_SIZE, 16 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
