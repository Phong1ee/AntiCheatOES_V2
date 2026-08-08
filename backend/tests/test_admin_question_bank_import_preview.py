import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, event, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import Chapter, ChapterLO, ChapterQuestion, LO, LOQuestion, Option, Question, Subject, User
from src.route.adminRoute import build_question_bank_import_preview
from src.service.question_bank_import_parser import parse_question_bank_text


IMPORT_TEXT = """QUESTION BANK
SUBJECT
Subject ID: DB
Subject Name: Databases
Description: Database concepts.

CHAPTER: Normalization
QUESTION 1
Type: Multiple Choice
Difficulty: Easy
Learning Objectives: Normalize data | Identify keys
Content: What normal form reduces redundant data?
A. First normal form
B. Normalization
Answer: B

CHAPTER: Transactions
QUESTION 2
Type: True/False
Difficulty: Medium
Learning Objectives: Explain ACID
Content: ACID properties are used in database transactions.
Answer: True
"""


class AdminQuestionBankImportPreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.db.add_all(
            [
                User(school_id="A1", full_name="Admin", email="admin@example.test", password_hash="x", role="admin"),
                User(school_id="T1", full_name="Teacher", email="teacher@example.test", password_hash="x", role="teacher"),
                Subject(subject_id="DB", subject_name="Databases", subject_description="Database subject"),
                Subject(subject_id="DS310", subject_name="Fundamentals of Data Science", subject_description="Data Science subject"),
                Chapter(chapter_id=1, chapter_name="  normalization ", chapter_description="DB", subject_id="DB"),
                LO(lo_id=10, lo_name="Normalize data", lo_description="LO"),
            ]
        )
        self.db.flush()
        self.db.add(ChapterLO(chapter_id=1, lo_id=10))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _admin(self):
        return {"school_id": "A1", "role": "admin"}

    def _preview(self, text: str = IMPORT_TEXT, subject_id: str = "DB"):
        return build_question_bank_import_preview(parse_question_bank_text(text), subject_id, self._admin(), self.db)

    def _row_counts(self):
        return {
            table.__tablename__: self.db.query(func.count()).select_from(table).scalar()
            for table in (Subject, Chapter, LO, ChapterLO, Question, Option, ChapterQuestion, LOQuestion)
        }

    def test_preview_resolves_existing_and_new_taxonomy_with_multiple_los(self):
        preview = self._preview()

        self.assertEqual(preview["subject"]["status"], "valid")
        self.assertEqual(preview["chapters"], [
            {"chapter_name": "Normalization", "action": "reuse", "chapter_id": 1},
            {"chapter_name": "Transactions", "action": "create"},
        ])
        self.assertEqual(preview["learning_objectives"], [
            {"chapter_name": "Normalization", "lo_name": "Normalize data", "action": "reuse", "lo_id": 10},
            {"chapter_name": "Normalization", "lo_name": "Identify keys", "action": "create"},
            {"chapter_name": "Transactions", "lo_name": "Explain ACID", "action": "create"},
        ])
        self.assertEqual(preview["questions"][0]["learning_objectives"], ["Normalize data", "Identify keys"])
        self.assertEqual(preview["summary"], {
            "total_questions": 2,
            "valid_questions": 2,
            "duplicate_questions": 0,
            "error_questions": 0,
            "chapters_to_create": 1,
            "learning_objectives_to_create": 2,
        })

    def test_preview_detects_exact_duplicate_without_fuzzy_matching(self):
        self.db.add(Question(
            question_text="What normal form reduces redundant data?",
            question_type="MCQ",
            question_difficulties="easy",
            subject_id="DB",
            created_by="A1",
            question_status="approved",
        ))
        self.db.commit()

        preview = self._preview()

        self.assertEqual(preview["questions"][0]["status"], "duplicate")
        self.assertEqual(preview["questions"][0]["warnings"], ["This question already exists and will be skipped."])
        self.assertEqual(preview["questions"][1]["status"], "valid")

    def test_subject_id_mismatch_is_a_blocking_error(self):
        text = IMPORT_TEXT.replace("Subject ID: DB", "Subject ID: DS310", 1)

        with self.assertRaises(HTTPException) as raised:
            self._preview(text)

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(
            raised.exception.detail,
            "The uploaded file belongs to subject DS310, but the selected subject is DB.",
        )

    def test_subject_name_difference_is_returned_as_a_warning(self):
        preview = self._preview(IMPORT_TEXT.replace("Subject Name: Databases", "Subject Name: Database Systems", 1))

        self.assertEqual(preview["subject"]["status"], "valid")
        self.assertEqual(len(preview["subject"]["warnings"]), 1)
        self.assertIn("differs", preview["subject"]["warnings"][0])

    def test_missing_selected_subject_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            self._preview(subject_id="UNKNOWN")

        self.assertEqual(raised.exception.status_code, 404)

    def test_preview_never_changes_database_row_counts(self):
        before = self._row_counts()

        self._preview()

        self.assertEqual(self._row_counts(), before)

    def test_non_admin_cannot_preview(self):
        with self.assertRaises(HTTPException) as raised:
            build_question_bank_import_preview(
                parse_question_bank_text(IMPORT_TEXT), "DB", {"school_id": "T1", "role": "teacher"}, self.db
            )

        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
