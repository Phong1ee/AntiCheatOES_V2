import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import Chapter, Exam, ExamQuestion, Option, Question, Subject, User
from src.models.teacher.requestModel.QuestionAddToDBRequest import QuestionAddToDBRequest
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest
from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
from src.models.teacher.requestModel.TeacherExamRequest import TeacherExamRequest
from src.route.teacherRoute.addExamRoute import delete_exam_from_database, update_exam_in_database
from src.route.teacherRoute.addQuestionsRoute import (
    add_question_to_database,
    delete_question_from_exam,
    update_question_in_exam,
)
from src.route.teacherRoute.getExamsRoute import get_exam_questions


def option(text: str, correct: bool = False, option_id: int | None = None):
    return QuestionOptionsRequest(options_id=option_id, options_text=text, is_correct=correct)


class TeacherExamIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        Base.metadata.create_all(cls.engine)
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
        self.db.add_all(
            [
                Chapter(chapter_id=1, chapter_name="DB Chapter", chapter_description="DB", subject_id="DB"),
                Chapter(chapter_id=2, chapter_name="Web Chapter", chapter_description="Web", subject_id="WEB"),
                Exam(manage_by="T1", title="Exam A", examcode="A", max_attempt=1, duration_minutes=60, subject_id="DB"),
                Exam(manage_by="T1", title="Exam B", examcode="B", max_attempt=1, duration_minutes=60, subject_id="DB"),
                Exam(manage_by="T2", title="Other", examcode="O", max_attempt=1, duration_minutes=60, subject_id="DB"),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _create(self, question_type="MCQ", chapter_ids=None, options=None):
        exam = self.db.query(Exam).filter_by(examcode="A").one()
        request = QuestionAddToDBRequest(
            question_text="Question text",
            question_difficulties="easy",
            question_type=question_type,
            subject_id="DB",
            chapter_ids=chapter_ids or [],
            options=options or [],
            exam_id=exam.exam_id,
            question_point=5,
        )
        return add_question_to_database(request, {"school_id": "T1"}, {}, self.db), exam

    def test_create_reload_true_false_and_optional_taxonomy(self):
        result, exam = self._create(
            "true-false", options=[option("True", True), option("False")]
        )
        rows = get_exam_questions(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(rows[0]["question_id"], result["question_id"])
        self.assertEqual(rows[0]["question_type"], "true-false")
        self.assertEqual(rows[0]["chapter_ids"], [])
        self.assertEqual(rows[0]["lo_ids"], [])

    def test_update_adds_and_removes_mcq_options(self):
        result, exam = self._create(options=[option("A", True), option("B")])
        question = self.db.query(Question).filter_by(question_id=result["question_id"]).one()
        original = sorted(question.options, key=lambda item: item.options_id)
        update_question_in_exam(
            exam.exam_id,
            question.question_id,
            QuestionUpdateRequest(
                question_point=6,
                question_type="MCQ",
                subject_id="DB",
                chapter_ids=[1],
                lo_ids=[],
                options=[option("A", True, original[0].options_id), option("B", False, original[1].options_id), option("C")],
            ),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.db.expire_all()
        self.assertEqual(self.db.query(Option).filter_by(question_id=question.question_id).count(), 3)
        current = self.db.query(Option).filter_by(question_id=question.question_id).order_by(Option.options_id).all()
        update_question_in_exam(
            exam.exam_id,
            question.question_id,
            QuestionUpdateRequest(
                question_point=6,
                question_type="MCQ",
                subject_id="DB",
                chapter_ids=[],
                lo_ids=[],
                options=[option(current[0].options_text, True, current[0].options_id), option(current[2].options_text, False, current[2].options_id)],
            ),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual(self.db.query(Option).filter_by(question_id=question.question_id).count(), 2)

    def test_rejects_chapter_from_another_subject(self):
        with self.assertRaises(HTTPException) as raised:
            self._create(chapter_ids=[2], options=[option("A", True), option("B")])
        self.assertEqual(raised.exception.status_code, 400)

    def test_removing_from_exam_preserves_reusable_data_and_other_exam(self):
        result, exam_a = self._create(options=[option("A", True), option("B")])
        exam_b = self.db.query(Exam).filter_by(examcode="B").one()
        self.db.add(ExamQuestion(exam_id=exam_b.exam_id, question_id=result["question_id"], question_point=5))
        self.db.commit()
        delete_question_from_exam(exam_a.exam_id, result["question_id"], {"school_id": "T1"}, {}, self.db)
        self.assertIsNotNone(self.db.get(Question, result["question_id"]))
        self.assertEqual(self.db.query(Option).filter_by(question_id=result["question_id"]).count(), 2)
        self.assertIsNotNone(self.db.query(ExamQuestion).filter_by(exam_id=exam_b.exam_id, question_id=result["question_id"]).first())

    def test_other_teacher_cannot_update_or_remove_question(self):
        result, _ = self._create(options=[option("A", True), option("B")])
        other_exam = self.db.query(Exam).filter_by(examcode="O").one()
        with self.assertRaises(HTTPException) as raised:
            delete_question_from_exam(other_exam.exam_id, result["question_id"], {"school_id": "T1"}, {}, self.db)
        self.assertEqual(raised.exception.status_code, 403)

    def test_update_exam_persists_and_rejects_other_teacher(self):
        exam = self.db.query(Exam).filter_by(examcode="A").one()
        request = TeacherExamRequest(
            title="Updated title",
            examcode="A-UPDATED",
            max_attempt=3,
            description="Updated",
            duration_minutes=75,
            result_visibility="score-only",
            subject_id="DB",
        )
        update_exam_in_database(exam.exam_id, request, {"school_id": "T1"}, {}, self.db)
        self.db.expire_all()
        updated = self.db.get(Exam, exam.exam_id)
        self.assertEqual((updated.title, updated.max_attempt), ("Updated title", 3))
        other = self.db.query(Exam).filter_by(examcode="O").one()
        with self.assertRaises(HTTPException) as raised:
            update_exam_in_database(other.exam_id, request, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(raised.exception.status_code, 403)

    def test_delete_exam_preserves_reusable_question(self):
        result, exam = self._create(options=[option("A", True), option("B")])
        delete_exam_from_database(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertIsNone(self.db.get(Exam, exam.exam_id))
        self.assertIsNotNone(self.db.get(Question, result["question_id"]))
        self.assertEqual(self.db.query(Option).filter_by(question_id=result["question_id"]).count(), 2)


if __name__ == "__main__":
    unittest.main()
