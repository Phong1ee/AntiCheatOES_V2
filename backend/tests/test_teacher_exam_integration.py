import unittest
from datetime import datetime

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import Chapter, Exam, ExamQuestion, ExamSetting, Option, Question, QuestionStatus, Subject, User
from src.models.teacher.requestModel.ExamSettingsRequest import ExamSettingsRequest
from src.models.teacher.requestModel.QuestionAddToDBRequest import QuestionAddToDBRequest
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest
from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
from src.models.teacher.requestModel.TeacherExamRequest import TeacherExamRequest
from src.models.teacher.requestModel.QuestionsSelectFromBank import QuestionsSelectFromBank
from src.route.teacherRoute.addExamRoute import add_exam_to_database, delete_exam_from_database, update_exam_in_database
from src.route.teacherRoute.addQuestionsRoute import (
    add_questions_to_exam_from_question_bank,
    add_question_to_database,
    delete_question_from_exam,
    get_question_import_candidates,
    update_question_in_exam,
)
from src.route.teacherRoute.examSettingsRoute import (
    create_exam_settings,
    delete_exam_settings,
    get_exam_settings,
    update_exam_settings,
)
from src.route.teacherRoute.getExamsRoute import get_exam, get_exam_questions, get_teacher_exams


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
                question_difficulties="hard",
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
        self.assertEqual(self.db.get(Question, question.question_id).question_difficulties.value, "hard")
        current = self.db.query(Option).filter_by(question_id=question.question_id).order_by(Option.options_id).all()
        update_question_in_exam(
            exam.exam_id,
            question.question_id,
            QuestionUpdateRequest(
                question_point=6,
                question_difficulties="medium",
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
        self.db.expire_all()
        self.assertEqual(self.db.get(Question, question.question_id).question_difficulties.value, "medium")

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
            start_time=datetime(2026, 8, 3, 9, 15),
            end_time=datetime(2026, 8, 3, 17, 45),
            status="archived",
            result_visibility="score-only",
            subject_id="DB",
            total_points=120,
            passing_score=72,
        )
        update_exam_in_database(exam.exam_id, request, {"school_id": "T1"}, {}, self.db)
        self.db.expire_all()
        updated = self.db.get(Exam, exam.exam_id)
        self.assertEqual((updated.title, updated.max_attempt), ("Updated title", 3))
        self.assertEqual((updated.total_points, updated.passing_score), (120, 72))
        self.assertEqual((updated.start_time, updated.end_time), (datetime(2026, 8, 3, 9, 15), datetime(2026, 8, 3, 17, 45)))
        self.assertEqual(updated.status.value, "archived")
        for exam_status in ("draft", "published", "archived"):
            update_exam_in_database(
                exam.exam_id,
                TeacherExamRequest(**{**request.model_dump(), "status": exam_status}),
                {"school_id": "T1"},
                {},
                self.db,
            )
            self.assertEqual(self.db.get(Exam, exam.exam_id).status.value, exam_status)
        detail = get_exam(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        listed = get_teacher_exams({"school_id": "T1"}, {}, self.db)
        self.assertEqual((detail["total_points"], detail["passing_score"]), (120, 72))
        listed_exam = next(item for item in listed if item["exam_id"] == exam.exam_id)
        self.assertEqual((listed_exam["total_points"], listed_exam["passing_score"]), (120, 72))
        self.assertEqual((detail["status"], listed_exam["status"]), ("archived", "archived"))
        self.assertEqual(detail["start_time"], "2026-08-03T09:15:00")
        other = self.db.query(Exam).filter_by(examcode="O").one()
        with self.assertRaises(HTTPException) as raised:
            update_exam_in_database(other.exam_id, request, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(raised.exception.status_code, 403)

    def test_create_exam_persists_scores_and_rejects_invalid_score_range(self):
        request = TeacherExamRequest(
            title="Scored exam",
            examcode="SCORED",
            max_attempt=2,
            description="Scores",
            duration_minutes=45,
            start_time=datetime(2026, 9, 10, 8, 0),
            end_time=datetime(2026, 9, 12, 18, 30),
            result_visibility="full",
            subject_id="DB",
            total_points=80,
            passing_score=48,
        )
        created = add_exam_to_database(request, {"school_id": "T1"}, {}, self.db)
        reloaded = get_exam(created["exam_id"], {"school_id": "T1"}, {}, self.db)
        self.assertEqual((reloaded["total_points"], reloaded["passing_score"]), (80, 48))
        self.assertEqual((reloaded["start_time"], reloaded["end_time"]), ("2026-09-10T08:00:00", "2026-09-12T18:30:00"))
        self.assertEqual(reloaded["status"], "draft")
        for exam_status in ("draft", "published", "archived"):
            status_request = request.model_copy(update={"examcode": f"STATUS-{exam_status}", "status": exam_status})
            status_result = add_exam_to_database(status_request, {"school_id": "T1"}, {}, self.db)
            self.assertEqual(status_result["status"], exam_status)
        with self.assertRaises(ValidationError):
            TeacherExamRequest(
                title="Invalid",
                examcode="INVALID",
                max_attempt=1,
                description="Invalid",
                duration_minutes=30,
                start_time=datetime(2026, 9, 10, 8, 0),
                end_time=datetime(2026, 9, 10, 7, 59),
                result_visibility="full",
                subject_id="DB",
                total_points=20,
                passing_score=21,
            )
    def test_exam_request_rejects_invalid_schedule_and_status(self):
        common = {
            "title": "Invalid",
            "examcode": "INVALID-SCHEDULE",
            "max_attempt": 1,
            "description": "Invalid",
            "duration_minutes": 30,
            "result_visibility": "full",
            "subject_id": "DB",
        }
        with self.assertRaises(ValidationError):
            TeacherExamRequest(**common, start_time=datetime(2026, 9, 10, 8), end_time=datetime(2026, 9, 10, 8))
        with self.assertRaises(ValidationError):
            TeacherExamRequest(**common, start_time=datetime(2026, 9, 10, 8), end_time=datetime(2026, 9, 10, 9), status="scheduled")

    def _bank_question(
        self,
        owner: str,
        status: QuestionStatus,
        text: str,
        question_type: str = "essay",
        difficulty: str = "medium",
        subject_id: str = "DB",
    ) -> Question:
        teacher = self.db.query(User).filter_by(school_id=owner).one()
        question = Question(
            question_text=text,
            question_difficulties=difficulty,
            question_type=question_type,
            subject_id=subject_id,
            created_by=teacher.id,
            question_status=status,
        )
        self.db.add(question)
        self.db.flush()
        return question

    def test_import_candidates_apply_visibility_rules(self):
        approved_own = self._bank_question("T1", QuestionStatus.approved, "Approved own")
        approved_other = self._bank_question("T2", QuestionStatus.approved, "Approved other")
        draft_own = self._bank_question("T1", QuestionStatus.draft, "Draft own")
        pending_own = self._bank_question("T1", QuestionStatus.pending, "Pending own")
        self._bank_question("T2", QuestionStatus.draft, "Draft other")
        self._bank_question("T2", QuestionStatus.pending, "Pending other")
        self._bank_question("T1", QuestionStatus.rejected, "Rejected own")
        self.db.commit()
        exam = self.db.query(Exam).filter_by(examcode="A").one()
        result = get_question_import_candidates(exam.exam_id, 1, 50, {"school_id": "T1"}, {}, self.db)
        ids = {item["question_id"] for item in result["items"]}
        self.assertEqual(ids, {approved_own.question_id, approved_other.question_id, draft_own.question_id, pending_own.question_id})
        self.assertEqual(result["page_size"], 50)
        self.assertTrue(all("creator" in item for item in result["items"]))

    def test_import_candidate_filters_and_pagination(self):
        teacher_two = self.db.query(User).filter_by(school_id="T2").one()
        target = self._bank_question("T2", QuestionStatus.approved, "Unique normalization prompt", "MCQ", "hard", "DB")
        self._bank_question("T1", QuestionStatus.draft, "Own web draft", "essay", "easy", "WEB")
        for index in range(23):
            self._bank_question("T2", QuestionStatus.approved, f"Approved item {index:02d}")
        self._bank_question("T2", QuestionStatus.draft, "Private hidden item")
        self.db.commit()
        exam = self.db.query(Exam).filter_by(examcode="A").one()

        default_page = get_question_import_candidates(exam.exam_id, current_user={"school_id": "T1"}, role_check={}, db=self.db)
        self.assertEqual((len(default_page["items"]), default_page["page_size"]), (10, 10))
        self.assertEqual(default_page["total"], 25)
        self.assertEqual(default_page["total_pages"], 3)
        final_page = get_question_import_candidates(exam.exam_id, 2, 20, {"school_id": "T1"}, {}, self.db)
        self.assertEqual((len(final_page["items"]), final_page["total_pages"]), (5, 2))

        filters = [
            {"search": "NORMALIZATION"},
            {"question_type": "MCQ"},
            {"difficulty": "hard"},
            {"subject_id": "DB", "search": "Unique"},
            {"status_filter": "approved", "search": "Unique"},
            {"created_by": teacher_two.id, "search": "Unique"},
        ]
        for filter_values in filters:
            result = get_question_import_candidates(
                exam.exam_id,
                current_user={"school_id": "T1"},
                role_check={},
                db=self.db,
                **filter_values,
            )
            self.assertEqual([item["question_id"] for item in result["items"]], [target.question_id])
        hidden = get_question_import_candidates(
            exam.exam_id,
            current_user={"school_id": "T1"},
            role_check={},
            db=self.db,
            search="Private hidden",
        )
        self.assertEqual((hidden["items"], hidden["total"], hidden["total_pages"]), ([], 0, 0))

    def test_bulk_import_is_atomic_and_rejects_duplicates_and_private_questions(self):
        approved = self._bank_question("T2", QuestionStatus.approved, "Approved")
        own_draft = self._bank_question("T1", QuestionStatus.draft, "Own draft")
        other_draft = self._bank_question("T2", QuestionStatus.draft, "Other draft")
        self.db.commit()
        exam = self.db.query(Exam).filter_by(examcode="A").one()
        result = add_questions_to_exam_from_question_bank(
            exam.exam_id,
            [
                QuestionsSelectFromBank(question_id=approved.question_id, question_point=3),
                QuestionsSelectFromBank(question_id=own_draft.question_id, question_point=7),
            ],
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual(result["imported_count"], 2)
        points = {
            row.question_id: row.question_point
            for row in self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id).all()
        }
        self.assertEqual(points, {approved.question_id: 3, own_draft.question_id: 7})

        with self.assertRaises(HTTPException) as duplicate:
            add_questions_to_exam_from_question_bank(
                exam.exam_id,
                [QuestionsSelectFromBank(question_id=approved.question_id, question_point=2)],
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(duplicate.exception.status_code, 409)

        before = self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id).count()
        new_approved = self._bank_question("T2", QuestionStatus.approved, "Another approved")
        self.db.commit()
        with self.assertRaises(HTTPException) as unauthorized:
            add_questions_to_exam_from_question_bank(
                exam.exam_id,
                [
                    QuestionsSelectFromBank(question_id=new_approved.question_id, question_point=4),
                    QuestionsSelectFromBank(question_id=other_draft.question_id, question_point=4),
                ],
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(unauthorized.exception.status_code, 403)
        self.assertEqual(self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id).count(), before)

    def test_exam_settings_crud_isolation_ownership_and_validation(self):
        exam_a = self.db.query(Exam).filter_by(examcode="A").one()
        exam_b = self.db.query(Exam).filter_by(examcode="B").one()
        other = self.db.query(Exam).filter_by(examcode="O").one()
        defaults = get_exam_settings(exam_a.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(defaults.grace_period, 0)
        self.assertTrue(defaults.auto_submit_on_expire)
        with self.assertRaises(HTTPException) as conflict:
            create_exam_settings(exam_a.exam_id, ExamSettingsRequest(), {"school_id": "T1"}, {}, self.db)
        self.assertEqual(conflict.exception.status_code, 409)

        payload = ExamSettingsRequest(
            shuffle_question=True,
            shuffle_answer_options=True,
            auto_submit_on_expire=False,
            grace_period=5,
            force_fullscreen_thresh=2,
            tab_switch_thresh=0,
            copy_paste_thresh=4,
            auto_grade=False,
        )
        updated = update_exam_settings(exam_a.exam_id, payload, {"school_id": "T1"}, {}, self.db)
        self.assertEqual((updated.grace_period, updated.force_fullscreen_thresh, updated.tab_switch_thresh, updated.copy_paste_thresh), (5, 2, 0, 4))
        other_defaults = get_exam_settings(exam_b.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual((other_defaults.grace_period, other_defaults.tab_switch_thresh), (0, 0))

        with self.assertRaises(HTTPException) as forbidden:
            get_exam_settings(other.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(forbidden.exception.status_code, 404)
        with self.assertRaises(ValidationError):
            ExamSettingsRequest(grace_period=-1)
        with self.assertRaises(ValidationError):
            ExamSettingsRequest(tab_switch_thresh=True)

        delete_exam_settings(exam_a.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertIsNone(self.db.get(ExamSetting, exam_a.exam_id))

    def test_delete_exam_preserves_reusable_question(self):
        result, exam = self._create(options=[option("A", True), option("B")])
        get_exam_settings(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        delete_exam_from_database(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertIsNone(self.db.get(Exam, exam.exam_id))
        self.assertIsNone(self.db.get(ExamSetting, exam.exam_id))
        self.assertIsNotNone(self.db.get(Question, result["question_id"]))
        self.assertEqual(self.db.query(Option).filter_by(question_id=result["question_id"]).count(), 2)


if __name__ == "__main__":
    unittest.main()
