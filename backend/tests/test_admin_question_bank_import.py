import asyncio
from io import BytesIO
import inspect
import unittest

from docx import Document
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine, event, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import Chapter, ChapterLO, ChapterQuestion, LO, LOQuestion, Option, Question, Subject, User
from src.route.adminRoute import import_question_bank, import_question_bank_data
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

QUESTION 3
Type: Essay
Difficulty: Hard
Learning Objectives: Explain ACID
Content: Explain why transactions require ACID properties.
"""


def _docx_bytes(content: str) -> bytes:
    document = Document()
    for line in content.splitlines():
        document.add_paragraph(line)
    output = BytesIO()
    document.save(output)
    return output.getvalue()


def _pdf_bytes(content: str) -> bytes:
    escaped_lines = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in content.splitlines()]
    stream = "BT /F1 9 Tf 72 760 Td " + " ".join(f"({line}) Tj 0 -12 Td" for line in escaped_lines) + " ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(stream.encode('latin-1'))} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n{obj}\nendobj\n".encode("latin-1"))
    xref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode("ascii"))
    return bytes(pdf)


class AdminQuestionBankImportTests(unittest.TestCase):
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
                Subject(subject_id="DS310", subject_name="Data Science", subject_description="Data Science subject"),
                Chapter(chapter_id=1, chapter_name="Normalization", chapter_description="DB", subject_id="DB"),
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

    def _upload(self, filename: str, content: bytes) -> UploadFile:
        return UploadFile(filename=filename, file=BytesIO(content))

    def _endpoint_import(self, filename: str, content: bytes, subject_id: str = "DB"):
        return asyncio.run(import_question_bank(self._upload(filename, content), subject_id, self._admin(), {}, self.db))

    def _row_counts(self):
        return {
            table.__tablename__: self.db.query(func.count()).select_from(table).scalar()
            for table in (Subject, Chapter, LO, ChapterLO, Question, Option, ChapterQuestion, LOQuestion)
        }

    def test_successful_docx_import_creates_and_reuses_taxonomy_and_all_question_types(self):
        result = self._endpoint_import("questions.docx", _docx_bytes(IMPORT_TEXT))

        self.assertEqual(result["imported_count"], 3)
        self.assertEqual(result["duplicate_skipped_count"], 0)
        self.assertEqual(result["chapters_created"], 1)
        self.assertEqual(result["learning_objectives_created"], 2)
        self.assertEqual(len(result["question_ids"]), 3)
        self.assertEqual(self.db.query(Chapter).filter_by(subject_id="DB").count(), 2)
        self.assertEqual(self.db.query(LO).count(), 3)

        mcq, true_false, essay = [self.db.get(Question, question_id) for question_id in result["question_ids"]]
        self.assertEqual(mcq.created_by, "A1")
        self.assertEqual(len(mcq.lo_questions), 2)
        self.assertEqual(mcq.question_status.value, "approved")
        self.assertEqual(len(mcq.options), 2)
        self.assertEqual([option.options_text for option in true_false.options], ["True", "False"])
        self.assertEqual(sum(option.is_correct for option in true_false.options), 1)
        self.assertEqual(essay.options, [])
        self.assertEqual(len(essay.lo_questions), 1)

    def test_successful_text_pdf_import(self):
        result = self._endpoint_import("questions.pdf", _pdf_bytes(IMPORT_TEXT))

        self.assertEqual(result["imported_count"], 3)
        self.assertEqual(self.db.query(Question).count(), 3)

    def test_mismatch_rejects_entire_import(self):
        before = self._row_counts()
        mismatched = IMPORT_TEXT.replace("Subject ID: DB", "Subject ID: DS310", 1)

        with self.assertRaises(HTTPException) as raised:
            self._endpoint_import("questions.docx", _docx_bytes(mismatched))

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(self._row_counts(), before)

    def test_duplicate_and_second_identical_import_do_not_create_question_copies(self):
        first = self._endpoint_import("questions.docx", _docx_bytes(IMPORT_TEXT))
        counts_after_first = self._row_counts()
        second = self._endpoint_import("questions.docx", _docx_bytes(IMPORT_TEXT))

        self.assertEqual(first["imported_count"], 3)
        self.assertEqual(second["imported_count"], 0)
        self.assertEqual(second["duplicate_skipped_count"], 3)
        self.assertEqual(self.db.query(Question).count(), 3)
        self.assertEqual(self._row_counts(), counts_after_first)

    def test_import_preserves_all_three_learning_objective_mappings(self):
        text = """SUBJECT
Subject ID: DB
Subject Name: Databases
Description: Database concepts.

CHAPTER: Normalization
QUESTION 1
Type: Multiple Choice
Difficulty: Easy
Learning Objectives: Normalize data | Identify keys | Explain dependencies
Content: Which practice reduces repeated data?
A. Normalization
B. Duplication
Answer: A
"""

        result = import_question_bank_data(parse_question_bank_text(text), "DB", self._admin(), self.db)
        question = self.db.get(Question, result["question_ids"][0])

        self.assertEqual(result["learning_objectives_created"], 2)
        self.assertEqual(len(question.lo_questions), 3)
        self.assertEqual(
            sorted(link.lo.lo_name for link in question.lo_questions),
            ["Explain dependencies", "Identify keys", "Normalize data"],
        )

    def test_import_rolls_back_all_taxonomy_and_questions_after_mid_import_failure(self):
        before = self._row_counts()

        def fail_on_second_question(_, __, target):
            if target.question_text.startswith("ACID properties"):
                raise RuntimeError("forced database failure")

        event.listen(Question, "before_insert", fail_on_second_question)
        try:
            with self.assertRaises(HTTPException) as raised:
                self._endpoint_import("questions.docx", _docx_bytes(IMPORT_TEXT))
        finally:
            event.remove(Question, "before_insert", fail_on_second_question)

        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(self._row_counts(), before)

    def test_selected_subject_must_exist_and_non_admin_is_forbidden(self):
        parsed = parse_question_bank_text(IMPORT_TEXT)
        with self.assertRaises(HTTPException) as missing:
            import_question_bank_data(parsed, "MISSING", self._admin(), self.db)
        self.assertEqual(missing.exception.status_code, 404)

        with self.assertRaises(HTTPException) as denied:
            import_question_bank_data(parsed, "DB", {"school_id": "T1", "role": "teacher"}, self.db)
        self.assertEqual(denied.exception.status_code, 403)

    def test_import_uses_database_generated_ids_not_max_id_math(self):
        result = self._endpoint_import("questions.docx", _docx_bytes(IMPORT_TEXT))

        self.assertTrue(all(question_id > 0 for question_id in result["question_ids"]))
        self.assertNotIn("max(", inspect.getsource(import_question_bank_data).casefold())


if __name__ == "__main__":
    unittest.main()
