import unittest
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import (
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
    TeacherSubject,
    User,
)
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest
from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
from src.models.teacher.requestModel.QuestionsSelectFromBank import QuestionsSelectFromBank
from src.models.teacher.requestModel.TeacherExamRequest import TeacherExamRequest
from src.route.teacherRoute.addExamRoute import add_exam_to_database, update_exam_in_database
from src.route.teacherRoute.addQuestionsRoute import (
    add_questions_to_exam_from_question_bank,
    get_question_import_candidates,
    get_questions_from_question_bank,
    update_question_in_exam,
)
from src.route.teacherRoute.getExamsRoute import (
    get_exam_overview,
    get_exam_question,
    get_exam_questions,
)


def option(text: str, correct: bool, option_id: int | None = None) -> QuestionOptionsRequest:
    return QuestionOptionsRequest(
        options_id=option_id,
        options_text=text,
        is_correct=correct,
    )


def enum_value(value):
    return value.value if hasattr(value, "value") else value


class TeacherExamSubjectPermissionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        event.listen(
            cls.engine,
            "connect",
            lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"),
        )
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.db.add_all(
            [
                User(
                    school_id="T1",
                    full_name="Teacher One",
                    email="t1@permissions.test",
                    password_hash="x",
                    role="teacher",
                ),
                User(
                    school_id="T2",
                    full_name="Teacher Two",
                    email="t2@permissions.test",
                    password_hash="x",
                    role="teacher",
                ),
                Subject(
                    subject_id="DB",
                    subject_name="Databases",
                    subject_description="Database subject",
                ),
                Subject(
                    subject_id="WEB",
                    subject_name="Web",
                    subject_description="Web subject",
                ),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [
                TeacherSubject(teacher_id="T1", subject_id="DB", is_active=True),
                TeacherSubject(teacher_id="T1", subject_id="WEB", is_active=False),
                TeacherSubject(teacher_id="T2", subject_id="WEB", is_active=True),
                Chapter(
                    chapter_id=1,
                    chapter_name="Database design",
                    chapter_description="DB",
                    subject_id="DB",
                ),
                Chapter(
                    chapter_id=2,
                    chapter_name="Web foundations",
                    chapter_description="WEB",
                    subject_id="WEB",
                ),
                LO(lo_id=1, lo_name="Normalize", lo_description="Normalize data"),
                LO(lo_id=2, lo_name="Build UI", lo_description="Build a UI"),
                Exam(
                    manage_by="T1",
                    title="Teacher One Exam",
                    examcode="T1-EXAM",
                    max_attempt=1,
                    duration_minutes=60,
                    subject_id="DB",
                ),
                Exam(
                    manage_by="T2",
                    title="Teacher Two Exam",
                    examcode="T2-EXAM",
                    max_attempt=1,
                    duration_minutes=60,
                    subject_id="WEB",
                ),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [
                ChapterLO(chapter_id=1, lo_id=1),
                ChapterLO(chapter_id=2, lo_id=2),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _exam_request(self, subject_id: str, examcode: str) -> TeacherExamRequest:
        return TeacherExamRequest(
            title=f"{subject_id} Exam",
            examcode=examcode,
            max_attempt=1,
            description="Permission test",
            duration_minutes=45,
            start_time=datetime(2026, 9, 1, 8, 0),
            end_time=datetime(2026, 9, 1, 9, 0),
            result_visibility="hidden",
            subject_id=subject_id,
        )

    def _shared_web_question(self) -> Question:
        question = Question(
            question_text="Original shared question",
            question_difficulties="medium",
            question_type="MCQ",
            subject_id="WEB",
            created_by="T2",
            question_status=QuestionStatus.approved,
            source_question_id=None,
        )
        self.db.add(question)
        self.db.flush()
        self.db.add_all(
            [
                ChapterQuestion(question_id=question.question_id, chapter_id=2),
                LOQuestion(question_id=question.question_id, lo_id=2),
                Option(question_id=question.question_id, options_text="A", is_correct=True),
                Option(question_id=question.question_id, options_text="B", is_correct=False),
            ]
        )
        self.db.commit()
        return question

    def _attach_shared_web_question(self) -> tuple[Exam, Question]:
        """Import requires an active WEB assignment; the caller's inactive
        precondition is restored immediately after so downstream assertions
        about an unassigned teacher still hold."""
        exam = self.db.query(Exam).filter_by(examcode="T1-EXAM").one()
        question = self._shared_web_question()
        assignment = self.db.query(TeacherSubject).filter_by(
            teacher_id="T1", subject_id="WEB"
        ).one()
        assignment.is_active = True
        self.db.commit()
        result = add_questions_to_exam_from_question_bank(
            exam.exam_id,
            [QuestionsSelectFromBank(question_id=question.question_id)],
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual(result["imported_question_ids"], [question.question_id])
        assignment.is_active = False
        self.db.commit()
        return exam, question

    def test_overview_contains_only_active_assignments_and_real_counts(self):
        self.db.add(
            Question(
                question_text="Counted DB question",
                question_difficulties="easy",
                question_type="essay",
                subject_id="DB",
                created_by="T1",
                question_status=QuestionStatus.draft,
            )
        )
        self.db.commit()

        overview = get_exam_overview({"school_id": "T1"}, {}, self.db)

        self.assertEqual([item["subject_id"] for item in overview["subjects"]], ["DB"])
        self.assertEqual(overview["subjects"][0]["subject_description"], "Database subject")
        self.assertEqual(overview["subjects"][0]["question_count"], 1)

    def test_create_requires_an_existing_active_subject_assignment(self):
        created = add_exam_to_database(
            self._exam_request("DB", "ACTIVE-DB"),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual(created["subject_id"], "DB")

        for examcode in ("INACTIVE-WEB", "FORGED-WEB"):
            with self.assertRaises(HTTPException) as forbidden:
                add_exam_to_database(
                    self._exam_request("WEB", examcode),
                    {"school_id": "T1"},
                    {},
                    self.db,
                )
            self.assertEqual(forbidden.exception.status_code, 403)

        with self.assertRaises(HTTPException) as missing:
            add_exam_to_database(
                self._exam_request("MISSING", "MISSING-SUBJECT"),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(missing.exception.status_code, 404)

    def test_legacy_exam_can_keep_revoked_subject_but_cannot_change_to_unassigned(self):
        exam = self.db.query(Exam).filter_by(examcode="T1-EXAM").one()
        self.db.query(TeacherSubject).filter_by(
            teacher_id="T1", subject_id="DB"
        ).update({"is_active": False})
        self.db.commit()

        unchanged = update_exam_in_database(
            exam.exam_id,
            self._exam_request("DB", "T1-EXAM"),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual(unchanged["subject_id"], "DB")

        with self.assertRaises(HTTPException) as forbidden:
            update_exam_in_database(
                exam.exam_id,
                self._exam_request("WEB", "T1-EXAM"),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(forbidden.exception.status_code, 403)

    def test_unassigned_shared_question_allows_points_only_without_content_mutation(self):
        exam, question = self._attach_shared_web_question()
        before = {
            "text": question.question_text,
            "type": enum_value(question.question_type),
            "difficulty": enum_value(question.question_difficulties),
            "subject": question.subject_id,
            "status": enum_value(question.question_status),
            "source": question.source_question_id,
            "chapters": [item.chapter_id for item in question.chapter_questions],
            "los": [item.lo_id for item in question.lo_questions],
            "options": [
                (item.options_id, item.options_text, item.is_correct)
                for item in sorted(question.options, key=lambda item: item.options_id)
            ],
        }

        result = update_question_in_exam(
            exam.exam_id,
            question.question_id,
            QuestionUpdateRequest(max_score=Decimal("3.25")),
            {"school_id": "T1"},
            {},
            self.db,
        )

        self.assertFalse(result["cloned"])
        self.assertEqual(self.db.query(Question).count(), 1)
        link = self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id).one()
        self.assertEqual((link.question_id, link.question_point), (question.question_id, Decimal("3.25")))
        self.db.expire_all()
        persisted = self.db.get(Question, question.question_id)
        after = {
            "text": persisted.question_text,
            "type": enum_value(persisted.question_type),
            "difficulty": enum_value(persisted.question_difficulties),
            "subject": persisted.subject_id,
            "status": enum_value(persisted.question_status),
            "source": persisted.source_question_id,
            "chapters": [item.chapter_id for item in persisted.chapter_questions],
            "los": [item.lo_id for item in persisted.lo_questions],
            "options": [
                (item.options_id, item.options_text, item.is_correct)
                for item in sorted(persisted.options, key=lambda item: item.options_id)
            ],
        }
        self.assertEqual(after, before)

    def test_unassigned_shared_question_rejects_content_change(self):
        exam, question = self._attach_shared_web_question()
        original_options = [
            option(item.options_text, item.is_correct, item.options_id)
            for item in sorted(question.options, key=lambda item: item.options_id)
        ]

        with self.assertRaises(HTTPException) as forbidden:
            update_question_in_exam(
                exam.exam_id,
                question.question_id,
                QuestionUpdateRequest(
                    max_score=2,
                    question_text="Forbidden edit",
                    question_difficulties="hard",
                    question_type="MCQ",
                    subject_id="WEB",
                    chapter_ids=[2],
                    lo_ids=[2],
                    options=original_options,
                ),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(forbidden.exception.status_code, 403)
        self.assertEqual(self.db.get(Question, question.question_id).question_text, "Original shared question")
        self.assertEqual(self.db.query(Question).count(), 1)

    def test_assigned_shared_question_clones_and_returns_exact_capabilities(self):
        exam, question = self._attach_shared_web_question()
        before = get_exam_question(
            exam.exam_id,
            question.question_id,
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertFalse(before["can_edit_content"])
        self.assertTrue(before["can_edit_points"])
        self.assertEqual(before["question_bank_target_id"], question.question_id)
        self.assertEqual(before["question_bank_target_tab"], "bank")
        self.assertIsNone(before["source_question_id"])

        assignment = self.db.query(TeacherSubject).filter_by(
            teacher_id="T1", subject_id="WEB"
        ).one()
        assignment.is_active = True
        self.db.commit()
        original_options = [
            option(item.options_text, item.is_correct, item.options_id)
            for item in sorted(question.options, key=lambda item: item.options_id)
        ]
        original_options[0].options_text = "Edited A"

        result = update_question_in_exam(
            exam.exam_id,
            question.question_id,
            QuestionUpdateRequest(
                max_score=Decimal("4.50"),
                question_text="Exam-local editable clone",
                question_difficulties="hard",
                question_type="MCQ",
                subject_id="WEB",
                chapter_ids=[2],
                lo_ids=[2],
                options=original_options,
            ),
            {"school_id": "T1"},
            {},
            self.db,
        )

        self.assertTrue(result["cloned"])
        self.assertNotEqual(result["question_id"], question.question_id)
        self.db.expire_all()
        self.assertEqual(self.db.get(Question, question.question_id).question_text, "Original shared question")
        clone = self.db.get(Question, result["question_id"])
        self.assertEqual((clone.created_by, clone.question_status, clone.source_question_id), (
            "T1", QuestionStatus.draft, question.question_id
        ))
        link = self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id).one()
        self.assertEqual((link.question_id, link.question_point), (clone.question_id, Decimal("4.50")))

        rows = get_exam_questions(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["can_edit_content"])
        self.assertTrue(rows[0]["can_edit_points"])
        self.assertEqual(rows[0]["source_question_id"], question.question_id)
        self.assertEqual(rows[0]["question_bank_target_id"], clone.question_id)
        self.assertEqual(rows[0]["question_bank_target_tab"], "mine")

    def test_clone_failure_rolls_back_question_and_exam_link(self):
        exam = self.db.query(Exam).filter_by(examcode="T1-EXAM").one()
        source = Question(
            question_text="Approved DB source",
            question_difficulties="medium",
            question_type="essay",
            subject_id="DB",
            created_by="T2",
            question_status=QuestionStatus.approved,
        )
        self.db.add(source)
        self.db.flush()
        self.db.add(ExamQuestion(exam_id=exam.exam_id, question_id=source.question_id, question_point=1))
        self.db.commit()
        before_count = self.db.query(Question).count()

        def fail_after_partial_clone(db, source, teacher_id, request, chapters, los):
            del request, chapters, los
            partial = Question(
                question_text="Partial clone",
                question_difficulties="easy",
                question_type="essay",
                subject_id=source.subject_id,
                created_by=teacher_id,
                question_status=QuestionStatus.draft,
                source_question_id=source.question_id,
            )
            db.add(partial)
            db.flush()
            raise RuntimeError("simulated clone failure")

        with patch(
            "src.route.teacherRoute.addQuestionsRoute._clone_question",
            side_effect=fail_after_partial_clone,
        ):
            with self.assertRaises(RuntimeError):
                update_question_in_exam(
                    exam.exam_id,
                    source.question_id,
                    QuestionUpdateRequest(
                        max_score=2,
                        question_text="Requested edit",
                    ),
                    {"school_id": "T1"},
                    {},
                    self.db,
                )

        self.assertEqual(self.db.query(Question).count(), before_count)
        link = self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id).one()
        self.assertEqual((link.question_id, link.question_point), (source.question_id, Decimal("1.00")))

    def test_other_teacher_exam_cannot_be_used_to_bypass_authorization(self):
        other_exam = self.db.query(Exam).filter_by(examcode="T2-EXAM").one()
        question = self._shared_web_question()
        self.db.add(ExamQuestion(exam_id=other_exam.exam_id, question_id=question.question_id, question_point=1))
        self.db.commit()

        with self.assertRaises(HTTPException) as forbidden_read:
            get_exam_question(
                other_exam.exam_id,
                question.question_id,
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(forbidden_read.exception.status_code, 403)

        with self.assertRaises(HTTPException) as forbidden_write:
            update_question_in_exam(
                other_exam.exam_id,
                question.question_id,
                QuestionUpdateRequest(max_score=9),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(forbidden_write.exception.status_code, 403)

    def test_import_rejects_question_from_unassigned_subject(self):
        exam = self.db.query(Exam).filter_by(examcode="T1-EXAM").one()
        question = self._shared_web_question()

        with self.assertRaises(HTTPException) as forbidden:
            add_questions_to_exam_from_question_bank(
                exam.exam_id,
                [QuestionsSelectFromBank(question_id=question.question_id)],
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(forbidden.exception.status_code, 403)
        self.assertEqual(
            self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id).count(), 0
        )

    def test_browse_endpoints_reject_and_exclude_unassigned_subject(self):
        exam = self.db.query(Exam).filter_by(examcode="T1-EXAM").one()
        self._shared_web_question()

        with self.assertRaises(HTTPException) as forbidden:
            get_questions_from_question_bank(
                "WEB",
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(forbidden.exception.status_code, 403)

        with self.assertRaises(HTTPException) as forbidden_filter:
            get_question_import_candidates(
                exam.exam_id,
                1,
                10,
                {"school_id": "T1"},
                {},
                self.db,
                None,
                None,
                None,
                "WEB",
                None,
                None,
            )
        self.assertEqual(forbidden_filter.exception.status_code, 403)

        candidates = get_question_import_candidates(
            exam.exam_id,
            1,
            10,
            {"school_id": "T1"},
            {},
            self.db,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        self.assertEqual(candidates["items"], [])
        self.assertEqual(candidates["filter_options"]["subjects"], [])


if __name__ == "__main__":
    unittest.main()
