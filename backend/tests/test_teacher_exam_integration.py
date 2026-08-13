import unittest
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import (
    Attempt,
    AttemptStatus,
    AttemptQuestion,
    Chapter,
    EssayAnswer,
    Exam,
    ExamEvent,
    ExamPoolConfig,
    ExamPoolQuestion,
    ExamPoolRule,
    ExamQuestion,
    ExamSetting,
    Option,
    Question,
    QuestionSelectionMode,
    QuestionStatus,
    ResultStrategy,
    StudentExam,
    Subject,
    TeacherSubject,
    User,
)
from src.models.teacher.requestModel.ExamSettingsRequest import ExamSettingsRequest
from src.models.teacher.requestModel.QuestionAddToDBRequest import QuestionAddToDBRequest
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest
from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
from src.models.teacher.requestModel.TeacherExamRequest import (
    TeacherExamRequest,
    TeacherExamStatusRequest,
    TeacherResultVisibilityRequest,
)
from src.models.teacher.requestModel.QuestionsSelectFromBank import QuestionsSelectFromBank
from src.middleware.authMiddleware import TEACHER_ONLY
from src.route.teacherRoute.addExamRoute import (
    add_exam_to_database,
    delete_exam_from_database,
    duplicate_exam,
    update_exam_in_database,
    update_result_visibility,
    update_exam_status,
)
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
from src.route.teacherRoute.resultsRoute import (
    GradeEssayRequest,
    _essay_counts,
    grade_essay_answer,
    list_essay_answers,
)


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
                TeacherSubject(teacher_id="T1", subject_id="DB", is_active=True),
                TeacherSubject(teacher_id="T1", subject_id="WEB", is_active=False),
                TeacherSubject(teacher_id="T2", subject_id="DB", is_active=True),
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
            status="draft",
            result_visibility="score-only",
            subject_id="DB",
            total_points=100,
            passing_score=6,
        )
        update_exam_in_database(exam.exam_id, request, {"school_id": "T1"}, {}, self.db)
        self.db.expire_all()
        updated = self.db.get(Exam, exam.exam_id)
        self.assertEqual((updated.title, updated.max_attempt), ("Updated title", 3))
        self.assertEqual((updated.total_points, updated.passing_score), (100, 6))
        self.assertEqual((updated.start_time, updated.end_time), (datetime(2026, 8, 3, 9, 15), datetime(2026, 8, 3, 17, 45)))
        self.assertEqual(updated.status.value, "draft")
        teacher = self.db.query(User).filter_by(school_id="T1").one()
        publish_question = Question(
            question_text="Publish validation question",
            question_difficulties="medium",
            question_type="essay",
            subject_id="DB",
            created_by=teacher.school_id,
            question_status=QuestionStatus.draft,
        )
        self.db.add(publish_question)
        self.db.flush()
        self.db.add(ExamQuestion(exam_id=exam.exam_id, question_id=publish_question.question_id, question_point=12))
        self.db.commit()
        for exam_status in ("draft", "published"):
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
        self.assertEqual((detail["total_points"], detail["passing_score"]), (100, 6))
        listed_exam = next(item for item in listed if item["exam_id"] == exam.exam_id)
        self.assertEqual((listed_exam["total_points"], listed_exam["passing_score"]), (100, 6))
        self.assertEqual((detail["status"], listed_exam["status"]), ("published", "published"))
        self.assertEqual(detail["start_time"], "2026-08-03T09:15:00")
        other = self.db.query(Exam).filter_by(examcode="O").one()
        with self.assertRaises(HTTPException) as raised:
            update_exam_in_database(other.exam_id, request, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(raised.exception.status_code, 403)

    def test_teacher_can_change_result_visibility_without_changing_scores(self):
        exam = self.db.query(Exam).filter_by(examcode="A").one()
        student = User(
            school_id="S1",
            full_name="Student One",
            email="s1@example.test",
            password_hash="x",
            role="student",
        )
        self.db.add(student)
        self.db.flush()
        attempt = Attempt(exam_id=exam.exam_id, student_id=student.school_id, score=7)
        student_exam = StudentExam(exam_id=exam.exam_id, student_id=student.school_id, final_score=8)
        self.db.add_all([attempt, student_exam])
        self.db.commit()

        for visibility in ("score-only", "full", "hidden"):
            response = update_result_visibility(
                exam.exam_id,
                TeacherResultVisibilityRequest(result_visibility=visibility),
                {"school_id": "T1"},
                {},
                self.db,
            )
            self.db.expire_all()
            self.assertEqual(response, {"exam_id": exam.exam_id, "result_visibility": visibility})
            self.assertEqual(self.db.get(Exam, exam.exam_id).result_visibility.value, visibility)
            self.assertEqual(self.db.get(Attempt, attempt.attempt_id).score, 7)
            self.assertEqual(
                self.db.get(StudentExam, (student.school_id, exam.exam_id)).final_score,
                8,
            )

        detail = get_exam(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        listed = get_teacher_exams({"school_id": "T1"}, {}, self.db)
        listed_exam = next(item for item in listed if item["exam_id"] == exam.exam_id)
        self.assertEqual((detail["result_visibility"], listed_exam["result_visibility"]), ("hidden", "hidden"))

    def test_other_teacher_cannot_change_result_visibility(self):
        exam = self.db.query(Exam).filter_by(examcode="O").one()
        with self.assertRaises(HTTPException) as raised:
            update_result_visibility(
                exam.exam_id,
                TeacherResultVisibilityRequest(result_visibility="full"),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 403)

    def test_result_visibility_request_rejects_invalid_values(self):
        for visibility in ("score_only", "public", ""):
            with self.assertRaises(ValidationError):
                TeacherResultVisibilityRequest(result_visibility=visibility)

    def test_student_and_admin_cannot_pass_teacher_authorization(self):
        for role in ("student", "admin"):
            with self.assertRaises(HTTPException) as raised:
                TEACHER_ONLY({"school_id": "T1", "role": role})
            self.assertEqual(raised.exception.status_code, 403)

    def test_duplicate_owned_manual_exam_copies_configuration_without_student_data(self):
        source = self.db.query(Exam).filter_by(examcode="A").one()
        source.title = "Manual source"
        source.description = "Reusable configuration"
        source.max_attempt = 3
        source.duration_minutes = 75
        source.start_time = datetime(2026, 8, 3, 9, 0)
        source.end_time = datetime(2026, 8, 3, 11, 0)
        source.total_points = 5
        source.passing_score = 3
        source.status = "published"
        teacher = self.db.query(User).filter_by(school_id="T1").one()
        student = User(
            school_id="S1",
            full_name="Student One",
            email="s1@example.test",
            password_hash="x",
            role="student",
        )
        question = Question(
            question_text="Reusable essay",
            question_difficulties="medium",
            question_type="essay",
            subject_id="DB",
            created_by=teacher.school_id,
            question_status=QuestionStatus.approved,
        )
        self.db.add_all([student, question])
        self.db.flush()
        self.db.add_all(
            [
                ExamQuestion(exam_id=source.exam_id, question_id=question.question_id, question_point=5),
                ExamSetting(
                    exam_id=source.exam_id,
                    shuffle_question=True,
                    shuffle_answer_options=True,
                    sequential_navigation=True,
                    auto_submit_on_expire=False,
                    grace_period=4,
                    anti_cheat_enabled=True,
                    violation_limit=7,
                    auto_grade=False,
                ),
                StudentExam(student_id=student.school_id, exam_id=source.exam_id),
            ]
        )
        self.db.flush()
        attempt = Attempt(
            exam_id=source.exam_id,
            student_id=student.school_id,
            attempt_no=1,
            score=4,
            start_time=datetime(2026, 8, 3, 9, 0),
        )
        self.db.add(attempt)
        self.db.flush()
        self.db.add(AttemptQuestion(attempt_id=attempt.attempt_id, question_id=question.question_id, question_point=5))
        self.db.flush()
        self.db.add_all(
            [
                EssayAnswer(attempt_id=attempt.attempt_id, question_id=question.question_id, answer_text="Answer", score=4),
                ExamEvent(attempt_id=attempt.attempt_id, event_type="tab_switch", event_timestamp=datetime(2026, 8, 3, 9, 5)),
            ]
        )
        self.db.commit()
        original_question_count = self.db.query(Question).count()
        original_attempt_question_count = self.db.query(AttemptQuestion).count()
        original_answer_count = self.db.query(EssayAnswer).count()
        original_event_count = self.db.query(ExamEvent).count()

        result = duplicate_exam(source.exam_id, {"school_id": "T1"}, {}, self.db)
        duplicate = self.db.get(Exam, result["exam_id"])

        self.assertNotEqual(duplicate.exam_id, source.exam_id)
        self.assertNotEqual(duplicate.examcode, source.examcode)
        self.assertEqual(len(duplicate.examcode), 20)
        self.assertEqual(duplicate.status.value, "draft")
        self.assertEqual(duplicate.title, "Copy of Manual source")
        self.assertEqual(
            (duplicate.subject_id, duplicate.description, duplicate.duration_minutes, duplicate.max_attempt),
            (source.subject_id, source.description, source.duration_minutes, source.max_attempt),
        )
        copied_link = self.db.query(ExamQuestion).filter_by(exam_id=duplicate.exam_id).one()
        self.assertEqual((copied_link.question_id, copied_link.question_point), (question.question_id, 5))
        self.assertEqual(self.db.query(Question).count(), original_question_count)
        copied_settings = self.db.get(ExamSetting, duplicate.exam_id)
        self.assertEqual(
            (
                copied_settings.shuffle_question,
                copied_settings.sequential_navigation,
                copied_settings.grace_period,
                copied_settings.auto_grade,
            ),
            (True, True, 4, False),
        )
        self.assertEqual((copied_settings.anti_cheat_enabled, copied_settings.violation_limit), (True, 7))
        self.assertEqual(self.db.query(StudentExam).filter_by(exam_id=duplicate.exam_id).count(), 0)
        self.assertEqual(self.db.query(Attempt).filter_by(exam_id=duplicate.exam_id).count(), 0)
        self.assertEqual(result["totalStudents"], 0)
        self.assertEqual(self.db.query(AttemptQuestion).count(), original_attempt_question_count)
        self.assertEqual(self.db.query(EssayAnswer).count(), original_answer_count)
        self.assertEqual(self.db.query(ExamEvent).count(), original_event_count)

        other_exam = self.db.query(Exam).filter_by(examcode="O").one()
        with self.assertRaises(HTTPException) as forbidden:
            duplicate_exam(other_exam.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(forbidden.exception.status_code, 403)

    def test_duplicate_pool_exam_copies_rules_and_candidates(self):
        source = self.db.query(Exam).filter_by(examcode="B").one()
        source.question_selection_mode = QuestionSelectionMode.pool
        teacher = self.db.query(User).filter_by(school_id="T1").one()
        question = Question(
            question_text="Pool candidate",
            question_difficulties="easy",
            question_type="essay",
            subject_id="DB",
            created_by=teacher.school_id,
            question_status=QuestionStatus.approved,
        )
        self.db.add(question)
        self.db.flush()
        config = ExamPoolConfig(exam_id=source.exam_id, subject_id="DB", fixed_randomization=False, version=7)
        self.db.add(config)
        self.db.flush()
        rule = ExamPoolRule(
            pool_config_id=config.pool_config_id,
            chapter_id=1,
            lo_id=None,
            difficulty="easy",
            draw_count=1,
        )
        self.db.add(rule)
        self.db.flush()
        self.db.add(ExamPoolQuestion(rule_id=rule.rule_id, question_id=question.question_id))
        self.db.commit()

        result = duplicate_exam(source.exam_id, {"school_id": "T1"}, {}, self.db)
        copied_config = self.db.query(ExamPoolConfig).filter_by(exam_id=result["exam_id"]).one()
        copied_rule = self.db.query(ExamPoolRule).filter_by(pool_config_id=copied_config.pool_config_id).one()
        copied_candidate = self.db.query(ExamPoolQuestion).filter_by(rule_id=copied_rule.rule_id).one()
        self.assertEqual((copied_config.subject_id, copied_config.fixed_randomization, copied_config.version), ("DB", False, 7))
        self.assertEqual((copied_rule.chapter_id, copied_rule.lo_id, copied_rule.draw_count), (1, None, 1))
        self.assertEqual(copied_candidate.question_id, question.question_id)
        self.assertEqual(result["question_selection_mode"], "pool")

    def test_focused_status_updates_enforce_validation_and_ownership(self):
        valid = self.db.query(Exam).filter_by(examcode="A").one()
        valid.total_points = 5
        teacher = self.db.query(User).filter_by(school_id="T1").one()
        question = Question(
            question_text="Publishable",
            question_difficulties="medium",
            question_type="essay",
            subject_id="DB",
            created_by=teacher.school_id,
            question_status=QuestionStatus.approved,
        )
        self.db.add(question)
        self.db.flush()
        self.db.add(ExamQuestion(exam_id=valid.exam_id, question_id=question.question_id, question_point=5))
        self.db.commit()

        for target_status in ("draft", "published"):
            result = update_exam_status(
                valid.exam_id,
                TeacherExamStatusRequest(status=target_status),
                {"school_id": "T1"},
                {},
                self.db,
            )
            self.assertEqual(result["status"], target_status)
            self.assertEqual(self.db.get(Exam, valid.exam_id).status.value, target_status)

        invalid = self.db.query(Exam).filter_by(examcode="B").one()
        invalid.status = "draft"
        self.db.commit()
        with self.assertRaises(HTTPException) as publish_error:
            update_exam_status(
                invalid.exam_id,
                TeacherExamStatusRequest(status="published"),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(publish_error.exception.status_code, 422)
        self.assertIn("at least one question", publish_error.exception.detail)
        self.assertEqual(self.db.get(Exam, invalid.exam_id).status.value, "draft")

        other = self.db.query(Exam).filter_by(examcode="O").one()
        with self.assertRaises(HTTPException) as forbidden:
            update_exam_status(
                other.exam_id,
                TeacherExamStatusRequest(status="draft"),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(forbidden.exception.status_code, 403)
        with self.assertRaises(ValidationError):
            TeacherExamStatusRequest(status="scheduled")
        with self.assertRaises(ValidationError):
            TeacherExamStatusRequest(status="archived")

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
            total_points=100,
            passing_score=6,
        )
        created = add_exam_to_database(request, {"school_id": "T1"}, {}, self.db)
        reloaded = get_exam(created["exam_id"], {"school_id": "T1"}, {}, self.db)
        self.assertEqual((reloaded["total_points"], reloaded["passing_score"]), (100, 6))
        self.assertEqual((reloaded["start_time"], reloaded["end_time"]), ("2026-09-10T08:00:00", "2026-09-12T18:30:00"))
        self.assertEqual(reloaded["status"], "draft")
        for exam_status in ("draft",):
            status_request = request.model_copy(update={"examcode": f"STATUS-{exam_status}", "status": exam_status})
            status_result = add_exam_to_database(status_request, {"school_id": "T1"}, {}, self.db)
            self.assertEqual(status_result["status"], exam_status)
        with patch("src.route.teacherRoute.addExamRoute._validate_publishable"):
            published = add_exam_to_database(
                request.model_copy(update={"examcode": "STATUS-published-valid", "status": "published"}),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(published["status"], "published")
        with self.assertRaises(HTTPException) as published_without_questions:
            add_exam_to_database(
                request.model_copy(update={"examcode": "STATUS-published", "status": "published"}),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(published_without_questions.exception.status_code, 422)
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
                total_points=100,
                passing_score=100.01,
            )

    def test_exam_code_can_be_disabled_enabled_and_remains_unique_when_present(self):
        template = TeacherExamRequest(
            title="Optional code exam",
            examcode=None,
            max_attempt=1,
            description="No code required",
            duration_minutes=30,
            start_time=datetime(2026, 9, 10, 8, 0),
            end_time=datetime(2026, 9, 10, 9, 0),
            result_visibility="hidden",
            subject_id="DB",
            total_points=100,
            passing_score=5,
        )
        first = add_exam_to_database(template, {"school_id": "T1"}, {}, self.db)
        second = add_exam_to_database(
            template.model_copy(update={"title": "Another no-code exam"}),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertIsNone(first["examcode"])
        self.assertIsNone(second["examcode"])

        coded = self.db.query(Exam).filter_by(examcode="A").one()
        disabled = update_exam_in_database(
            coded.exam_id,
            template.model_copy(update={"title": coded.title}),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertIsNone(disabled["examcode"])
        enabled = update_exam_in_database(
            first["exam_id"],
            template.model_copy(update={"examcode": "  NEW-CODE  "}),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual(enabled["examcode"], "NEW-CODE")

        with self.assertRaises(HTTPException) as duplicate:
            add_exam_to_database(
                template.model_copy(update={"title": "Duplicate", "examcode": "NEW-CODE"}),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(duplicate.exception.status_code, 409)

        null_source = self.db.get(Exam, second["exam_id"])
        duplicated = duplicate_exam(null_source.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertIsNone(duplicated["examcode"])
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
        with self.assertRaises(ValidationError):
            TeacherExamRequest(**common, start_time=datetime(2026, 9, 10, 8), end_time=datetime(2026, 9, 10, 9), status="archived")

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
            created_by=teacher.school_id,
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
        # T1 is not actively assigned to WEB (see setUp), so this own draft is excluded
        # from the bank entirely, same as any other unassigned-subject question.
        self._bank_question("T1", QuestionStatus.draft, "Own web draft", "essay", "easy", "WEB")
        for index in range(23):
            self._bank_question("T2", QuestionStatus.approved, f"Approved item {index:02d}")
        self._bank_question("T2", QuestionStatus.draft, "Private hidden item")
        self.db.commit()
        exam = self.db.query(Exam).filter_by(examcode="A").one()

        default_page = get_question_import_candidates(exam.exam_id, current_user={"school_id": "T1"}, role_check={}, db=self.db)
        self.assertEqual((len(default_page["items"]), default_page["page_size"]), (10, 10))
        self.assertEqual(default_page["total"], 24)
        self.assertEqual(default_page["total_pages"], 3)
        final_page = get_question_import_candidates(exam.exam_id, 2, 20, {"school_id": "T1"}, {}, self.db)
        self.assertEqual((len(final_page["items"]), final_page["total_pages"]), (4, 2))

        filters = [
            {"search": "NORMALIZATION"},
            {"question_type": "MCQ"},
            {"difficulty": "hard"},
            {"subject_id": "DB", "search": "Unique"},
            {"status_filter": "approved", "search": "Unique"},
            {"created_by": teacher_two.school_id, "search": "Unique"},
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

    def test_id_only_import_defaults_new_questions_to_one_without_redistribution(self):
        exam = self.db.query(Exam).filter_by(examcode="A").one()
        exam.total_points = 10
        existing = self._bank_question("T1", QuestionStatus.draft, "Existing")
        imported_one = self._bank_question("T2", QuestionStatus.approved, "Imported one")
        imported_two = self._bank_question("T2", QuestionStatus.approved, "Imported two")
        self.db.add(ExamQuestion(exam_id=exam.exam_id, question_id=existing.question_id, question_point=4))
        self.db.commit()

        result = add_questions_to_exam_from_question_bank(
            exam.exam_id,
            [
                QuestionsSelectFromBank(question_id=imported_one.question_id),
                QuestionsSelectFromBank(question_id=imported_two.question_id),
            ],
            {"school_id": "T1"},
            {},
            self.db,
        )
        links = self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id).all()
        self.assertFalse(result["automatically_distributed"])
        self.assertTrue(result["default_max_score_applied"])
        self.assertEqual(set(result["imported_question_ids"]), {imported_one.question_id, imported_two.question_id})
        self.assertEqual(len(links), 3)
        self.assertTrue(all(Decimal(str(link.question_point)) > 0 for link in links))
        points = {link.question_id: Decimal(str(link.question_point)) for link in links}
        self.assertEqual(points[existing.question_id], Decimal("4.00"))
        self.assertEqual(points[imported_one.question_id], Decimal("1.00"))
        self.assertEqual(points[imported_two.question_id], Decimal("1.00"))

    def test_exam_settings_crud_isolation_ownership_and_validation(self):
        exam_a = self.db.query(Exam).filter_by(examcode="A").one()
        exam_b = self.db.query(Exam).filter_by(examcode="B").one()
        other = self.db.query(Exam).filter_by(examcode="O").one()
        defaults = get_exam_settings(exam_a.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(defaults.grace_period, 0)
        self.assertFalse(defaults.sequential_navigation)
        self.assertTrue(defaults.auto_submit_on_expire)
        self.assertEqual(defaults.result_strategy, ResultStrategy.highest)
        with self.assertRaises(HTTPException) as conflict:
            create_exam_settings(exam_a.exam_id, ExamSettingsRequest(), {"school_id": "T1"}, {}, self.db)
        self.assertEqual(conflict.exception.status_code, 409)

        payload = ExamSettingsRequest(
            shuffle_question=True,
            shuffle_answer_options=True,
            sequential_navigation=True,
            auto_submit_on_expire=False,
            grace_period=5,
            anti_cheat_enabled=True,
            violation_limit=6,
            auto_grade=False,
            result_strategy="average",
        )
        updated = update_exam_settings(exam_a.exam_id, payload, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(updated.grace_period, 5)
        self.assertEqual((updated.anti_cheat_enabled, updated.violation_limit), (True, 6))
        self.assertTrue(updated.sequential_navigation)
        self.assertEqual(updated.result_strategy, ResultStrategy.average)
        saved = get_exam_settings(exam_a.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertTrue(saved.sequential_navigation)
        other_defaults = get_exam_settings(exam_b.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(other_defaults.grace_period, 0)
        self.assertEqual((other_defaults.anti_cheat_enabled, other_defaults.violation_limit), (False, 5))
        self.assertFalse(other_defaults.sequential_navigation)

        with self.assertRaises(HTTPException) as forbidden:
            get_exam_settings(other.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(forbidden.exception.status_code, 404)
        with self.assertRaises(HTTPException) as forbidden_update:
            update_exam_settings(other.exam_id, payload, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(forbidden_update.exception.status_code, 404)
        with self.assertRaises(ValidationError):
            ExamSettingsRequest(grace_period=-1)
        with self.assertRaises(ValidationError):
            ExamSettingsRequest(legacy_threshold=True)
        with self.assertRaises(ValidationError):
            ExamSettingsRequest(anti_cheat_enabled=True, violation_limit=101)
        for invalid_limit in (0, -1, 1.5, True, "5"):
            with self.assertRaises(ValidationError):
                ExamSettingsRequest(anti_cheat_enabled=True, violation_limit=invalid_limit)
        with self.assertRaises(ValidationError):
            ExamSettingsRequest(anti_cheat_enabled="true", violation_limit=5)
        disabled = ExamSettingsRequest(anti_cheat_enabled=False, violation_limit=100)
        self.assertEqual((disabled.anti_cheat_enabled, disabled.violation_limit), (False, 100))
        with self.assertRaises(ValidationError):
            ExamSettingsRequest(result_strategy="median")

        delete_exam_settings(exam_a.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertIsNone(self.db.get(ExamSetting, exam_a.exam_id))

    def test_grading_strategy_persists_and_recalculates_final_scores(self):
        exam = self.db.query(Exam).filter_by(examcode="A").one()
        students = [
            User(school_id="S1", full_name="Student One", email="s1@example.test", password_hash="x", role="student"),
            User(school_id="S2", full_name="Student Two", email="s2@example.test", password_hash="x", role="student"),
            User(school_id="S3", full_name="Student Three", email="s3@example.test", password_hash="x", role="student"),
        ]
        self.db.add_all(students)
        self.db.flush()
        self.db.add_all(StudentExam(student_id=student.school_id, exam_id=exam.exam_id) for student in students)
        submitted_at = datetime(2026, 8, 3, 10, 0)
        self.db.add_all([
            Attempt(exam_id=exam.exam_id, student_id="S1", attempt_no=1, score=7, submitted_at=submitted_at, status=AttemptStatus.submitted),
            Attempt(exam_id=exam.exam_id, student_id="S1", attempt_no=2, score=8.5, submitted_at=submitted_at, status=AttemptStatus.submitted),
            Attempt(exam_id=exam.exam_id, student_id="S1", attempt_no=3, score=8, submitted_at=submitted_at, status=AttemptStatus.submitted),
            Attempt(exam_id=exam.exam_id, student_id="S1", attempt_no=4, score=9.9, status=AttemptStatus.in_progress),
            Attempt(exam_id=exam.exam_id, student_id="S3", attempt_no=1, score=7, submitted_at=submitted_at, status=AttemptStatus.submitted),
        ])
        self.db.commit()

        expected = {"highest": 8.5, "last_attempt": 8, "average": 7.83}
        for strategy, score in expected.items():
            payload = ExamSettingsRequest(result_strategy=strategy)
            saved = update_exam_settings(exam.exam_id, payload, {"school_id": "T1"}, {}, self.db) \
                if self.db.get(ExamSetting, exam.exam_id) else create_exam_settings(
                    exam.exam_id, payload, {"school_id": "T1"}, {}, self.db
                )
            self.db.expire_all()
            self.assertEqual(saved.result_strategy.value, strategy)
            self.assertEqual(float(self.db.get(StudentExam, ("S1", exam.exam_id)).final_score), score)
            self.assertIsNone(self.db.get(StudentExam, ("S2", exam.exam_id)).final_score)
            self.assertEqual(float(self.db.get(StudentExam, ("S3", exam.exam_id)).final_score), 7)
            reloaded = get_exam_settings(exam.exam_id, {"school_id": "T1"}, {}, self.db)
            self.assertEqual(reloaded.result_strategy.value, strategy)

    def test_blank_essays_are_excluded_and_manual_grade_refreshes_final_score(self):
        exam = self.db.query(Exam).filter_by(examcode="A").one()
        student = User(school_id="S1", full_name="Student One", email="s1@example.test", password_hash="x", role="student")
        teacher = self.db.query(User).filter_by(school_id="T1").one()
        self.db.add(student)
        self.db.flush()
        questions = [
            Question(question_text="Blank", question_type="essay", subject_id="DB", created_by=teacher.school_id, question_status=QuestionStatus.approved),
            Question(question_text="Meaningful", question_type="essay", subject_id="DB", created_by=teacher.school_id, question_status=QuestionStatus.approved),
        ]
        self.db.add_all(questions)
        self.db.flush()
        self.db.add(StudentExam(student_id=student.school_id, exam_id=exam.exam_id))
        attempt = Attempt(
            exam_id=exam.exam_id,
            student_id=student.school_id,
            attempt_no=1,
            score=0,
            submitted_at=datetime(2026, 8, 3, 10, 0),
            status=AttemptStatus.submitted,
        )
        self.db.add(attempt)
        self.db.flush()
        self.db.add_all([
            AttemptQuestion(
                attempt_id=attempt.attempt_id,
                question_id=questions[0].question_id,
                question_point=5,
                question_point_snapshot=5,
            ),
            AttemptQuestion(
                attempt_id=attempt.attempt_id,
                question_id=questions[1].question_id,
                question_point=10,
                question_point_snapshot=5,
            ),
        ])
        self.db.flush()
        blank = EssayAnswer(attempt_id=attempt.attempt_id, question_id=questions[0].question_id, answer_text="\t\n", score=0)
        meaningful = EssayAnswer(attempt_id=attempt.attempt_id, question_id=questions[1].question_id, answer_text="A real answer", score=None)
        self.db.add_all([blank, meaningful])
        self.db.commit()

        listed = list_essay_answers(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual([row["essayAnswerId"] for row in listed], [meaningful.essay_answer_id])
        self.assertEqual(listed[0]["maxPoints"], 5)
        self.assertEqual(_essay_counts(self.db, [attempt.attempt_id]), (2, 1))

        with self.assertRaises(HTTPException) as over_snapshot_maximum:
            grade_essay_answer(
                exam.exam_id,
                meaningful.essay_answer_id,
                GradeEssayRequest(score=Decimal("5.01")),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(over_snapshot_maximum.exception.status_code, 400)
        with self.assertRaises(ValidationError):
            GradeEssayRequest(score=Decimal("-0.01"))

        graded = grade_essay_answer(
            exam.exam_id,
            meaningful.essay_answer_id,
            GradeEssayRequest(score=4),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual((graded["attemptScore"], graded["finalScore"]), (40.0, 40.0))
        self.assertEqual(float(self.db.get(StudentExam, (student.school_id, exam.exam_id)).final_score), 40)

        rollback_question = Question(
            question_text="Rollback",
            question_type="essay",
            subject_id="DB",
            created_by=teacher.school_id,
            question_status=QuestionStatus.approved,
        )
        self.db.add(rollback_question)
        self.db.flush()
        self.db.add(AttemptQuestion(attempt_id=attempt.attempt_id, question_id=rollback_question.question_id, question_point=5))
        rollback_essay = EssayAnswer(
            attempt_id=attempt.attempt_id,
            question_id=rollback_question.question_id,
            answer_text="Must not persist after failure",
            score=None,
        )
        self.db.add(rollback_essay)
        self.db.commit()

        with patch("src.route.teacherRoute.resultsRoute.sync_student_final_score", side_effect=RuntimeError("sync failed")):
            with self.assertRaisesRegex(RuntimeError, "sync failed"):
                grade_essay_answer(
                    exam.exam_id,
                    rollback_essay.essay_answer_id,
                    GradeEssayRequest(score=3),
                    {"school_id": "T1"},
                    {},
                    self.db,
                )
        self.db.expire_all()
        self.assertIsNone(self.db.get(EssayAnswer, rollback_essay.essay_answer_id).score)
        self.assertEqual(float(self.db.get(Attempt, attempt.attempt_id).score), 40)

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
