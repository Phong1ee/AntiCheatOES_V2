import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import (
    Chapter,
    ChapterLO,
    Exam,
    ExamQuestion,
    LO,
    Option,
    Question,
    QuestionRevision,
    QuestionStatus,
    Subject,
    User,
)
import src.route.teacherRoute.questionBankRoute as question_bank_route
from src.route.teacherRoute.questionBankRoute import (
    QuestionBankPayload,
    QuestionOptionPayload,
    create_draft_question,
    delete_question,
    get_question_detail,
    list_approved_question_bank,
    list_my_questions,
    list_subject_counts,
    submit_question,
    update_question,
)


def option(text: str, correct: bool = False, option_id: int | None = None) -> QuestionOptionPayload:
    return QuestionOptionPayload(options_id=option_id, options_text=text, is_correct=correct)


class TeacherQuestionBankTests(unittest.TestCase):
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
                User(school_id="T1", full_name="Teacher One", email="t1@example.test", password_hash="x", role="teacher"),
                User(school_id="T2", full_name="Teacher Two", email="t2@example.test", password_hash="x", role="teacher"),
                Subject(subject_id="DB", subject_name="Databases", subject_description="Database subject"),
                Subject(subject_id="WEB", subject_name="Web", subject_description="Web subject"),
            ]
        )
        self.db.flush()
        self.teacher_one = self.db.query(User).filter_by(school_id="T1").one()
        self.teacher_two = self.db.query(User).filter_by(school_id="T2").one()
        self.db.add_all(
            [
                Chapter(chapter_id=1, chapter_name="Normalization", chapter_description="DB", subject_id="DB"),
                Chapter(chapter_id=2, chapter_name="Transactions", chapter_description="DB", subject_id="DB"),
                Chapter(chapter_id=3, chapter_name="HTML", chapter_description="WEB", subject_id="WEB"),
                LO(lo_id=10, lo_name="Analyze normal forms", lo_description="LO"),
                LO(lo_id=11, lo_name="Explain ACID", lo_description="LO"),
                LO(lo_id=12, lo_name="Use semantic tags", lo_description="LO"),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [
                ChapterLO(chapter_id=1, lo_id=10),
                ChapterLO(chapter_id=2, lo_id=11),
                ChapterLO(chapter_id=3, lo_id=12),
                Exam(manage_by="T1", title="Midterm", examcode="MID", max_attempt=1, duration_minutes=60, subject_id="DB"),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _current(self, school_id: str = "T1") -> dict:
        return {"school_id": school_id, "role": "teacher"}

    def _payload(self, **overrides) -> QuestionBankPayload:
        data = {
            "question_text": "What is normalization?",
            "question_type": "MCQ",
            "question_difficulties": "medium",
            "subject_id": "DB",
            "chapter_ids": [1],
            "lo_ids": [10],
            "options": [option("Reducing redundancy", True), option("Duplicating data")],
        }
        data.update(overrides)
        return QuestionBankPayload(**data)

    def _create_question(self, payload: QuestionBankPayload | None = None, school_id: str = "T1") -> dict:
        return create_draft_question(payload or self._payload(), self._current(school_id), {}, self.db)

    def test_teacher_creates_draft_and_server_assigns_owner_subject_and_status(self):
        result = self._create_question(self._payload(question_difficulties=None, chapter_ids=[], lo_ids=[]))
        question = self.db.get(Question, result["question_id"])
        self.assertEqual(question.created_by, self.teacher_one.id)
        self.assertEqual(question.question_status, QuestionStatus.draft)
        self.assertEqual(question.subject_id, "DB")
        self.assertIsNone(question.question_difficulties)

    def test_submit_rejects_missing_required_fields_and_invalid_answers(self):
        result = self._create_question()
        self.db.get(Question, result["question_id"]).subject_id = None
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            submit_question(result["question_id"], self._current(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 400)

        result = self._create_question(self._payload(options=[option("Only", False)]))
        with self.assertRaises(HTTPException) as raised:
            submit_question(result["question_id"], self._current(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 400)

    def test_submit_valid_draft_and_rejected_question_moves_to_pending(self):
        result = self._create_question()
        submit_question(result["question_id"], self._current(), {}, self.db)
        self.assertEqual(self.db.get(Question, result["question_id"]).question_status, QuestionStatus.pending)

        rejected = self._create_question()
        question = self.db.get(Question, rejected["question_id"])
        question.question_status = QuestionStatus.rejected
        self.db.commit()
        submit_question(rejected["question_id"], self._current(), {}, self.db)
        self.assertEqual(self.db.get(Question, rejected["question_id"]).question_status, QuestionStatus.pending)

    def test_bank_and_mine_have_distinct_scopes(self):
        own = self._create_question()
        other = self._create_question(school_id="T2")
        self.db.get(Question, own["question_id"]).question_status = QuestionStatus.approved
        self.db.get(Question, other["question_id"]).question_status = QuestionStatus.approved
        self.db.commit()

        bank = list_approved_question_bank(current_user=self._current(), role_check={}, db=self.db)
        mine = list_my_questions(current_user=self._current(), role_check={}, db=self.db)

        self.assertEqual(bank["total"], 2)
        self.assertEqual(mine["total"], 1)
        self.assertEqual(mine["items"][0]["question_id"], own["question_id"])

    def test_private_detail_and_writes_are_owner_only(self):
        private = self._create_question(school_id="T2")
        with self.assertRaises(HTTPException) as raised:
            get_question_detail(private["question_id"], self._current(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 404)

        with self.assertRaises(HTTPException) as raised:
            update_question(private["question_id"], self._payload(), self._current(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 404)

        with self.assertRaises(HTTPException) as raised:
            delete_question(private["question_id"], self._current(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 404)

    def test_pending_is_read_only_for_owner(self):
        result = self._create_question()
        question = self.db.get(Question, result["question_id"])
        question.question_status = QuestionStatus.pending
        self.db.commit()

        with self.assertRaises(HTTPException):
            update_question(result["question_id"], self._payload(), self._current(), {}, self.db)
        with self.assertRaises(HTTPException):
            delete_question(result["question_id"], self._current(), {}, self.db)
        with self.assertRaises(HTTPException):
            submit_question(result["question_id"], self._current(), {}, self.db)

    def test_approved_edit_creates_revision_and_moves_to_pending(self):
        result = self._create_question()
        question = self.db.get(Question, result["question_id"])
        question.question_status = QuestionStatus.approved
        self.db.commit()

        updated = update_question(
            result["question_id"],
            self._payload(question_text="Updated approved question", chapter_ids=[2], lo_ids=[11]),
            self._current(),
            {},
            self.db,
        )

        revision = self.db.query(QuestionRevision).filter_by(question_id=result["question_id"]).one()
        self.assertEqual(revision.question_text, "What is normalization?")
        self.assertEqual(revision.chapter_ids_snapshot, [1])
        self.assertEqual(revision.lo_ids_snapshot, [10])
        self.assertEqual(updated["question_status"], "pending")
        self.assertEqual([item.chapter_id for item in self.db.get(Question, result["question_id"]).chapter_questions], [2])

    def test_taxonomy_validation_uses_subject_chapter_and_chapter_lo(self):
        with self.assertRaises(HTTPException) as raised:
            self._create_question(self._payload(chapter_ids=[3], lo_ids=[]))
        self.assertEqual(raised.exception.status_code, 400)

        with self.assertRaises(HTTPException) as raised:
            self._create_question(self._payload(chapter_ids=[1], lo_ids=[12]))
        self.assertEqual(raised.exception.status_code, 400)

    def test_create_rejects_missing_subject_and_lo_without_chapter(self):
        before = self.db.query(Question).count()
        with self.assertRaises(HTTPException) as raised:
            self._create_question(self._payload(subject_id=None, chapter_ids=[], lo_ids=[]))
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(self.db.query(Question).count(), before)

        with self.assertRaises(HTTPException) as raised:
            self._create_question(self._payload(chapter_ids=[], lo_ids=[10]))
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(self.db.query(Question).count(), before)

    def test_taxonomy_supports_subject_only_and_subject_chapter_without_lo(self):
        subject_only = self._create_question(self._payload(chapter_ids=[], lo_ids=[]))
        subject_only_question = self.db.get(Question, subject_only["question_id"])
        self.assertEqual(subject_only_question.subject_id, "DB")
        self.assertEqual(subject_only_question.chapter_questions, [])
        self.assertEqual(subject_only_question.lo_questions, [])

        chapter_only = self._create_question(self._payload(chapter_ids=[1], lo_ids=[]))
        chapter_only_question = self.db.get(Question, chapter_only["question_id"])
        self.assertEqual([item.chapter_id for item in chapter_only_question.chapter_questions], [1])
        self.assertEqual(chapter_only_question.lo_questions, [])

    def test_duplicate_chapter_and_lo_ids_do_not_create_duplicate_relationships(self):
        result = self._create_question(self._payload(chapter_ids=[1, 1], lo_ids=[10, 10]))
        question = self.db.get(Question, result["question_id"])
        self.assertEqual([item.chapter_id for item in question.chapter_questions], [1])
        self.assertEqual([item.lo_id for item in question.lo_questions], [10])

    def test_update_from_taxonomy_to_subject_only_removes_old_relationships(self):
        result = self._create_question()
        update_question(
            result["question_id"],
            self._payload(chapter_ids=[], lo_ids=[]),
            self._current(),
            {},
            self.db,
        )

        question = self.db.get(Question, result["question_id"])
        self.assertEqual(question.subject_id, "DB")
        self.assertEqual(question.chapter_questions, [])
        self.assertEqual(question.lo_questions, [])

    def test_create_rolls_back_question_and_taxonomy_when_options_fail(self):
        before_questions = self.db.query(Question).count()
        before_options = self.db.query(Option).count()
        original_replace_options = question_bank_route._replace_options

        def fail_replace_options(*_args, **_kwargs):
            raise HTTPException(status_code=400, detail="Simulated option failure")

        question_bank_route._replace_options = fail_replace_options
        try:
            with self.assertRaises(HTTPException):
                self._create_question()
        finally:
            question_bank_route._replace_options = original_replace_options

        self.assertEqual(self.db.query(Question).count(), before_questions)
        self.assertEqual(self.db.query(Option).count(), before_options)
        self.assertEqual(self.db.query(Question).filter(Question.chapter_questions.any()).count(), 0)

    def test_delete_rejects_questions_used_by_exam(self):
        result = self._create_question()
        exam = self.db.query(Exam).filter_by(examcode="MID").one()
        self.db.add(ExamQuestion(exam_id=exam.exam_id, question_id=result["question_id"], question_point=5))
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            delete_question(result["question_id"], self._current(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 409)

    def test_list_detail_and_subject_count_response_shapes(self):
        result = self._create_question()
        question = self.db.get(Question, result["question_id"])
        question.question_status = QuestionStatus.approved
        self.db.commit()

        bank = list_approved_question_bank(current_user=self._current(), role_check={}, db=self.db)
        detail = get_question_detail(result["question_id"], self._current(), {}, self.db)
        counts = list_subject_counts(scope="bank", current_user=self._current(), role_check={}, db=self.db)

        self.assertEqual(bank["items"][0]["subject"]["subject_id"], "DB")
        self.assertEqual(bank["items"][0]["chapters"][0]["chapter_id"], 1)
        self.assertEqual(bank["items"][0]["learning_objectives"][0]["lo_id"], 10)
        self.assertIn("is_correct", detail["options"][0])
        self.assertEqual(counts["total_count"], 1)

    def test_mine_subject_counts_include_legacy_no_subject(self):
        self.db.add(
            Question(
                question_text="Legacy draft",
                question_type="essay",
                question_difficulties=None,
                subject_id=None,
                created_by=self.teacher_one.id,
                question_status=QuestionStatus.draft,
            )
        )
        self.db.commit()
        counts = list_subject_counts(scope="mine", current_user=self._current(), role_check={}, db=self.db)
        self.assertEqual(counts["total_count"], 1)
        self.assertEqual(counts["no_subject_count"], 1)


if __name__ == "__main__":
    unittest.main()
