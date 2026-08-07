import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import (
    Attempt,
    AttemptQuestion,
    Chapter,
    ChapterLO,
    ChapterQuestion,
    Exam,
    ExamQuestion,
    LO,
    LOQuestion,
    Option,
    Question,
    QuestionStatus,
    Subject,
    User,
)
from src.route.adminRoute import (
    RevisionOptionPayload,
    RevisionSnapshotPayload,
    create_central_question,
    delete_central_question,
    get_central_question_detail,
    list_central_question_bank,
    list_central_question_bank_chapters,
    list_central_question_bank_learning_objectives,
    list_central_question_bank_subjects,
    update_central_question,
)


class AdminCentralQuestionBankTests(unittest.TestCase):
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
            Subject(subject_id="DB", subject_name="Databases", subject_description="Database subject"),
            Subject(subject_id="WEB", subject_name="Web", subject_description="Web subject"),
            Chapter(chapter_id=1, chapter_name="Normalization", chapter_description="DB", subject_id="DB"),
            Chapter(chapter_id=2, chapter_name="Transactions", chapter_description="DB", subject_id="DB"),
            LO(lo_id=10, lo_name="Normalize data", lo_description="LO"),
            LO(lo_id=11, lo_name="Identify keys", lo_description="LO"),
            LO(lo_id=12, lo_name="Use transactions", lo_description="LO"),
        ])
        self.db.flush()
        self.db.add_all([ChapterLO(chapter_id=1, lo_id=10), ChapterLO(chapter_id=1, lo_id=11), ChapterLO(chapter_id=2, lo_id=12)])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _admin(self):
        return {"school_id": "A1", "role": "admin"}

    def _payload(self, **overrides):
        data = {
            "question_text": "What is normalization?",
            "question_type": "MCQ",
            "question_difficulties": "medium",
            "subject_id": "DB",
            "chapter_ids": [1],
            "lo_ids": [10],
            "options": [
                RevisionOptionPayload(options_text="Reducing redundancy", is_correct=True),
                RevisionOptionPayload(options_text="Duplicating data", is_correct=False),
            ],
        }
        data.update(overrides)
        return RevisionSnapshotPayload(**data)

    def _create(self, **overrides):
        return create_central_question(self._payload(**overrides), self._admin(), {}, self.db)

    def test_list_filters_paginates_and_returns_taxonomy(self):
        first = self._create(lo_ids=[10, 11])
        self._create(question_text="Transaction question", chapter_ids=[2], lo_ids=[12])
        self.db.add(Question(question_text="Draft", question_type="essay", question_difficulties="easy", subject_id="DB", created_by="A1", question_status=QuestionStatus.draft))
        self.db.commit()
        result = list_central_question_bank(search="normal", lo_id=11, page=1, page_size=1, current_user=self._admin(), role_check={}, db=self.db)
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["question_id"], first["question_id"])
        self.assertEqual(sorted(item["lo_id"] for item in result["items"][0]["learning_objectives"]), [10, 11])
        self.assertNotIn("options", result["items"][0])

    def test_taxonomy_and_detail_use_real_data(self):
        created = self._create(lo_ids=[10, 11])
        subjects = list_central_question_bank_subjects(self._admin(), {}, self.db)
        self.assertEqual({item["subject_id"] for item in subjects}, {"DB", "WEB"})
        self.assertEqual(next(item for item in subjects if item["subject_id"] == "WEB")["approved_question_count"], 0)
        self.assertEqual(len(list_central_question_bank_chapters("DB", self._admin(), {}, self.db)), 2)
        self.assertEqual(len(list_central_question_bank_learning_objectives(1, self._admin(), {}, self.db)), 2)
        detail = get_central_question_detail(created["question_id"], self._admin(), {}, self.db)
        self.assertEqual(len(detail["options"]), 2)
        self.assertEqual(sorted(item["lo_id"] for item in detail["learning_objectives"]), [10, 11])

    def test_create_and_update_multiple_learning_objectives(self):
        created = self._create(lo_ids=[10, 11])
        question = self.db.get(Question, created["question_id"])
        self.assertEqual(question.created_by, "A1")
        update_central_question(created["question_id"], self._payload(chapter_ids=[2], lo_ids=[12]), self._admin(), {}, self.db)
        self.assertEqual([link.lo_id for link in self.db.get(Question, created["question_id"]).lo_questions], [12])

    def test_invalid_lo_rolls_back_and_non_admin_is_rejected(self):
        created = self._create(lo_ids=[10, 11])
        with self.assertRaises(HTTPException) as raised:
            update_central_question(created["question_id"], self._payload(lo_ids=[12]), self._admin(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(sorted(link.lo_id for link in self.db.get(Question, created["question_id"]).lo_questions), [10, 11])
        with self.assertRaises(HTTPException) as raised:
            list_central_question_bank(current_user={"school_id": "T1", "role": "teacher"}, role_check={}, db=self.db)
        self.assertEqual(raised.exception.status_code, 403)

    def test_delete_unused_and_referenced_questions(self):
        unused = self._create()
        delete_central_question(unused["question_id"], self._admin(), {}, self.db)
        self.assertIsNone(self.db.get(Question, unused["question_id"]))
        referenced = self._create(question_text="Referenced")
        self.db.add(Exam(manage_by="T1", title="Exam", examcode="E1", max_attempt=1, duration_minutes=30, subject_id="DB"))
        self.db.flush()
        exam = self.db.query(Exam).filter_by(examcode="E1").one()
        self.db.add(ExamQuestion(exam_id=exam.exam_id, question_id=referenced["question_id"], question_point=1))
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            delete_central_question(referenced["question_id"], self._admin(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
