import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, event, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import AuditLog, Chapter, ChapterLO, LO, LOQuestion, Question, Subject, User
from src.route.adminRoute import build_new_subject_import_preview, import_new_subject_question_bank_data
from src.service.question_bank_import_parser import parse_question_bank_text


NEW_SUBJECT_TEXT = """SUBJECT
Subject ID: DS310
Subject Name: Fundamentals of Data Science
Description: A data science foundation.

CHAPTER: Introduction to Data Science
QUESTION 1
Type: Multiple Choice
Difficulty: Easy
Learning Objectives: Understand Data Science | Identify workflow | Explain data roles
Content: Which description best defines Data Science?
A. Using data to derive useful insights
B. Avoiding all analysis
Answer: A

QUESTION 2
Type: Essay
Difficulty: Hard
Learning Objectives: Explain data roles
Content: Explain the role of data cleaning.
"""


class AdminNewSubjectQuestionBankImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.db.add_all([
            User(school_id="A1", full_name="Admin", email="admin@example.test", password_hash="x", role="admin"),
            User(school_id="T1", full_name="Teacher", email="teacher@example.test", password_hash="x", role="teacher"),
            Subject(subject_id="EXIST", subject_name="Existing subject", subject_description="Existing"),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _parsed(self):
        return parse_question_bank_text(NEW_SUBJECT_TEXT)

    def _admin(self):
        return {"school_id": "A1", "role": "admin"}

    def _counts(self):
        return {
            table.__tablename__: self.db.query(func.count()).select_from(table).scalar()
            for table in (Subject, Chapter, LO, ChapterLO, Question, LOQuestion)
        }

    def test_preview_new_subject_is_read_only_and_marks_everything_new(self):
        before = self._counts()

        preview = build_new_subject_import_preview(self._parsed(), self._admin(), self.db)

        self.assertEqual(preview["subject"]["status"], "new")
        self.assertEqual(preview["summary"]["chapters_to_create"], 1)
        self.assertEqual(preview["summary"]["learning_objectives_to_create"], 3)
        self.assertTrue(all(item["action"] == "create" for item in preview["chapters"]))
        self.assertEqual(self._counts(), before)

    def test_existing_subject_is_not_silently_reused(self):
        existing_text = NEW_SUBJECT_TEXT.replace("Subject ID: DS310", "Subject ID: EXIST", 1)

        with self.assertRaises(HTTPException) as raised:
            build_new_subject_import_preview(parse_question_bank_text(existing_text), self._admin(), self.db)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("Select it and use Import Questions", raised.exception.detail)

    def test_confirmed_import_creates_subject_taxonomy_and_all_lo_mappings(self):
        result = import_new_subject_question_bank_data(self._parsed(), True, self._admin(), self.db)

        subject = self.db.get(Subject, "DS310")
        questions = self.db.query(Question).filter(Question.subject_id == "DS310").order_by(Question.question_id).all()
        self.assertEqual(result["subject"]["subject_id"], "DS310")
        self.assertEqual(subject.subject_name, "Fundamentals of Data Science")
        self.assertEqual(result["imported_count"], 2)
        self.assertEqual(result["chapters_created"], 1)
        self.assertEqual(result["learning_objectives_created"], 3)
        self.assertEqual(questions[0].created_by, "A1")
        self.assertEqual(questions[0].question_status.value, "approved")
        self.assertEqual(len(questions[0].lo_questions), 3)
        audit = self.db.query(AuditLog).one()
        self.assertEqual(audit.action, "QUESTION_IMPORT_COMPLETED")
        self.assertTrue(audit.metadata_json["new_subject"])

    def test_confirmation_is_required_and_existing_subject_remains_blocked(self):
        with self.assertRaises(HTTPException) as raised:
            import_new_subject_question_bank_data(self._parsed(), False, self._admin(), self.db)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertIsNone(self.db.get(Subject, "DS310"))

        import_new_subject_question_bank_data(self._parsed(), True, self._admin(), self.db)
        with self.assertRaises(HTTPException) as raised:
            import_new_subject_question_bank_data(self._parsed(), True, self._admin(), self.db)
        self.assertEqual(raised.exception.status_code, 409)

    def test_failure_rolls_back_subject_and_every_relation(self):
        before = self._counts()

        def fail_question_insert(_, __, target):
            if target.subject_id == "DS310":
                raise RuntimeError("forced failure")

        event.listen(Question, "before_insert", fail_question_insert)
        try:
            with self.assertRaises(HTTPException) as raised:
                import_new_subject_question_bank_data(self._parsed(), True, self._admin(), self.db)
        finally:
            event.remove(Question, "before_insert", fail_question_insert)

        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(self._counts(), before)
        self.assertIsNone(self.db.get(Subject, "DS310"))

    def test_non_admin_is_forbidden(self):
        with self.assertRaises(HTTPException) as raised:
            import_new_subject_question_bank_data(self._parsed(), True, {"school_id": "T1", "role": "teacher"}, self.db)

        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
