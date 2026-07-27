import unittest
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
    ExamPoolConfig,
    ExamQuestion,
    LO,
    LOQuestion,
    Option,
    Question,
    QuestionSelectionMode,
    QuestionStatus,
    Subject,
    User,
)
from src.models.teacher.requestModel.ExamQuestionPoolRequest import (
    BulkQuestionIdsRequest,
    PoolConfigRequest,
    PoolRuleRequest,
)
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest
from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
from src.route.teacherRoute.addQuestionsRoute import (
    bulk_remove_questions_from_exam,
    distribute_exam_question_points,
    update_question_in_exam,
)
from src.route.teacherRoute.examPoolRoute import (
    get_pool_availability,
    get_pool_config,
    put_pool_config,
)
from src.service.exam_pool_service import (
    distribute_points,
    seeded_random,
    select_unique_candidates,
)


def option(text: str, correct: bool = False, option_id: int | None = None):
    return QuestionOptionsRequest(
        options_id=option_id, options_text=text, is_correct=correct
    )


class ExamPoolFeatureTests(unittest.TestCase):
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
                    email="t1@exam.test",
                    password_hash="x",
                    role="teacher",
                ),
                User(
                    school_id="T2",
                    full_name="Teacher Two",
                    email="t2@exam.test",
                    password_hash="x",
                    role="teacher",
                ),
                Subject(
                    subject_id="DB",
                    subject_name="Databases",
                    subject_description="DB",
                ),
                Chapter(
                    chapter_id=1,
                    chapter_name="Design",
                    chapter_description="Design",
                    subject_id="DB",
                ),
                LO(lo_id=1, lo_name="Normalize", lo_description="Normalize"),
                LO(lo_id=2, lo_name="Model", lo_description="Model"),
                Exam(
                    manage_by="T1",
                    title="Pool exam",
                    examcode="POOL",
                    max_attempt=2,
                    duration_minutes=60,
                    subject_id="DB",
                    total_points=100,
                ),
            ]
        )
        self.db.flush()
        self.db.add_all(
            [ChapterLO(chapter_id=1, lo_id=1), ChapterLO(chapter_id=1, lo_id=2)]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _question(
        self,
        text: str,
        owner: str = "T2",
        question_status: QuestionStatus = QuestionStatus.approved,
        difficulty: str = "easy",
        lo_ids: tuple[int, ...] = (1,),
    ) -> Question:
        teacher = self.db.query(User).filter_by(school_id=owner).one()
        question = Question(
            question_text=text,
            question_type="MCQ",
            question_difficulties=difficulty,
            subject_id="DB",
            created_by=teacher.id,
            question_status=question_status,
        )
        self.db.add(question)
        self.db.flush()
        self.db.add(ChapterQuestion(chapter_id=1, question_id=question.question_id))
        self.db.add_all(
            LOQuestion(lo_id=lo_id, question_id=question.question_id)
            for lo_id in lo_ids
        )
        self.db.add_all(
            [
                Option(
                    question_id=question.question_id,
                    options_text="A",
                    is_correct=True,
                ),
                Option(
                    question_id=question.question_id,
                    options_text="B",
                    is_correct=False,
                ),
            ]
        )
        self.db.flush()
        return question

    def test_copy_on_write_preserves_approved_source_and_exam_point(self):
        source = self._question("Shared approved")
        exam = self.db.query(Exam).one()
        self.db.add(
            ExamQuestion(
                exam_id=exam.exam_id,
                question_id=source.question_id,
                question_point=Decimal("7.50"),
            )
        )
        self.db.commit()
        original_options = [
            option(item.options_text, item.is_correct, item.options_id)
            for item in sorted(source.options, key=lambda value: value.options_id)
        ]
        original_options[0].options_text = "Changed"
        response = update_question_in_exam(
            exam.exam_id,
            source.question_id,
            QuestionUpdateRequest(
                question_point=Decimal("7.50"),
                question_text="Exam-local edit",
                question_difficulties="easy",
                question_type="MCQ",
                subject_id="DB",
                chapter_ids=[1],
                lo_ids=[1, 2],
                options=original_options,
            ),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertTrue(response["cloned"])
        self.assertNotEqual(response["question_id"], source.question_id)
        self.db.expire_all()
        unchanged = self.db.get(Question, source.question_id)
        self.assertEqual(unchanged.question_text, "Shared approved")
        self.assertEqual([item.lo_id for item in unchanged.lo_questions], [1])
        cloned = self.db.get(Question, response["question_id"])
        self.assertEqual((cloned.created_by, cloned.question_status), (
            self.db.query(User).filter_by(school_id="T1").one().id,
            QuestionStatus.draft,
        ))
        self.assertEqual({item.lo_id for item in cloned.lo_questions}, {1, 2})
        link = self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id).one()
        self.assertEqual((link.question_id, link.question_point), (
            cloned.question_id,
            Decimal("7.50"),
        ))

    def test_owned_private_draft_updates_multiple_and_removes_all_los_without_clone(self):
        draft = self._question(
            "Private draft",
            owner="T1",
            question_status=QuestionStatus.draft,
            lo_ids=(1, 2),
        )
        exam = self.db.query(Exam).one()
        self.db.add(
            ExamQuestion(exam_id=exam.exam_id, question_id=draft.question_id, question_point=5)
        )
        self.db.commit()
        response = update_question_in_exam(
            exam.exam_id,
            draft.question_id,
            QuestionUpdateRequest(
                question_point=5,
                question_text="Private draft edited",
                question_difficulties="easy",
                question_type="MCQ",
                subject_id="DB",
                chapter_ids=[1],
                lo_ids=[],
                options=[
                    option(item.options_text, item.is_correct, item.options_id)
                    for item in sorted(draft.options, key=lambda value: value.options_id)
                ],
            ),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertFalse(response["cloned"])
        self.assertEqual(response["question_id"], draft.question_id)
        self.assertEqual(
            self.db.query(LOQuestion).filter_by(question_id=draft.question_id).count(),
            0,
        )

    def test_points_only_edit_does_not_clone(self):
        source = self._question("Approved points")
        exam = self.db.query(Exam).one()
        self.db.add(ExamQuestion(exam_id=exam.exam_id, question_id=source.question_id, question_point=2))
        self.db.commit()
        response = update_question_in_exam(
            exam.exam_id,
            source.question_id,
            QuestionUpdateRequest(question_point=Decimal("3.25")),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertFalse(response["cloned"])
        self.assertEqual(self.db.query(Question).count(), 1)
        self.assertEqual(
            self.db.query(ExamQuestion).one().question_point, Decimal("3.25")
        )

    def test_content_update_rolls_back_when_option_replacement_fails(self):
        draft = self._question(
            "Before rollback", owner="T1", question_status=QuestionStatus.draft
        )
        exam = self.db.query(Exam).one()
        self.db.add(ExamQuestion(exam_id=exam.exam_id, question_id=draft.question_id, question_point=5))
        self.db.commit()
        with patch(
            "src.route.teacherRoute.addQuestionsRoute._replace_options",
            side_effect=RuntimeError("simulated option failure"),
        ):
            with self.assertRaises(RuntimeError):
                update_question_in_exam(
                    exam.exam_id,
                    draft.question_id,
                    QuestionUpdateRequest(
                        question_point=5,
                        question_text="Must roll back",
                        question_difficulties="easy",
                        question_type="MCQ",
                        subject_id="DB",
                        chapter_ids=[1],
                        lo_ids=[],
                        options=[option("A", True), option("B")],
                    ),
                    {"school_id": "T1"},
                    {},
                    self.db,
                )
        self.db.expire_all()
        self.assertEqual(self.db.get(Question, draft.question_id).question_text, "Before rollback")
        self.assertEqual(
            {row.lo_id for row in self.db.get(Question, draft.question_id).lo_questions},
            {1},
        )

    def test_bulk_remove_and_even_distribution_preserve_reusable_data(self):
        exam = self.db.query(Exam).one()
        questions = [self._question(f"Question {index}") for index in range(3)]
        self.db.add_all(
            [
                ExamQuestion(
                    exam_id=exam.exam_id,
                    question_id=question.question_id,
                    question_point=1,
                )
                for question in questions
            ]
        )
        self.db.commit()
        result = distribute_exam_question_points(
            exam.exam_id, {"school_id": "T1"}, {}, self.db
        )
        self.assertEqual(result["total_points"], "100.00")
        self.assertEqual(
            [row.question_point for row in self.db.query(ExamQuestion).order_by(ExamQuestion.question_id)],
            [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")],
        )
        removed = bulk_remove_questions_from_exam(
            exam.exam_id,
            BulkQuestionIdsRequest(
                question_ids=[question.question_id for question in questions]
            ),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual(removed["removed_count"], 3)
        self.assertEqual(self.db.query(Question).count(), 3)
        self.assertEqual(self.db.query(Option).count(), 6)
        self.assertEqual(self.db.query(ChapterQuestion).count(), 3)
        self.assertEqual(self.db.query(LOQuestion).count(), 3)

    def test_pool_authorization_validation_persistence_and_overlap(self):
        own = self._question("Own draft", owner="T1", question_status=QuestionStatus.draft)
        approved = self._question("Other approved")
        self._question("Other private", question_status=QuestionStatus.pending)
        self.db.commit()
        exam = self.db.query(Exam).one()
        availability = get_pool_availability(
            exam.exam_id,
            "DB",
            {"school_id": "T1"},
            {},
            self.db,
        )
        lo_row = next(
            row
            for row in availability["rows"]
            if row["lo_id"] == 1 and row["difficulty"] == "easy"
        )
        self.assertEqual(lo_row["available_count"], 2)
        saved = put_pool_config(
            exam.exam_id,
            PoolConfigRequest(
                subject_id="DB",
                fixed_randomization=False,
                rules=[
                    PoolRuleRequest(
                        chapter_id=1,
                        lo_id=1,
                        difficulty="easy",
                        draw_count=2,
                    )
                ],
            ),
            {"school_id": "T1"},
            {},
            self.db,
        )
        self.assertEqual((saved["mode"], saved["total_questions"]), ("pool", 2))
        self.assertEqual(
            {candidate_id for candidate_id in (own.question_id, approved.question_id)},
            {
                row.question_id
                for rule in self.db.query(ExamPoolConfig).one().rules
                for row in rule.candidates
            },
        )
        reloaded = get_pool_config(
            exam.exam_id, {"school_id": "T1"}, {}, self.db
        )
        self.assertEqual(reloaded["version"], 1)
        self.assertEqual(self.db.get(Exam, exam.exam_id).question_selection_mode, QuestionSelectionMode.pool)

        with self.assertRaises(HTTPException) as insufficient:
            put_pool_config(
                exam.exam_id,
                PoolConfigRequest(
                    subject_id="DB",
                    rules=[
                        PoolRuleRequest(
                            chapter_id=1,
                            lo_id=1,
                            difficulty="easy",
                            draw_count=3,
                        )
                    ],
                ),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(insufficient.exception.status_code, 422)

        with self.assertRaises(HTTPException) as invalid_taxonomy:
            put_pool_config(
                exam.exam_id,
                PoolConfigRequest(
                    subject_id="DB",
                    rules=[
                        PoolRuleRequest(
                            chapter_id=1,
                            lo_id=999,
                            difficulty="easy",
                            draw_count=1,
                        )
                    ],
                ),
                {"school_id": "T1"},
                {},
                self.db,
            )
        self.assertEqual(invalid_taxonomy.exception.status_code, 422)

    def test_fixed_randomization_materializes_one_persisted_editable_set(self):
        exam = self.db.query(Exam).one()
        questions = [self._question(f"Fixed {index}") for index in range(4)]
        self.db.commit()
        saved = put_pool_config(
            exam.exam_id,
            PoolConfigRequest(
                subject_id="DB",
                fixed_randomization=True,
                rules=[
                    PoolRuleRequest(
                        chapter_id=1,
                        lo_id=1,
                        difficulty="easy",
                        draw_count=2,
                    )
                ],
            ),
            {"school_id": "T1"},
            {},
            self.db,
        )
        first_ids = {
            row.question_id
            for row in self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id)
        }
        self.assertEqual((saved["mode"], len(first_ids)), ("fixed_randomization", 2))
        reloaded = get_pool_config(exam.exam_id, {"school_id": "T1"}, {}, self.db)
        second_ids = {
            row.question_id
            for row in self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id)
        }
        self.assertEqual(first_ids, second_ids)
        self.assertEqual(reloaded["mode"], "fixed_randomization")
        self.assertEqual(
            sum(
                row.question_point
                for row in self.db.query(ExamQuestion).filter_by(exam_id=exam.exam_id)
            ),
            Decimal("100.00"),
        )
        self.assertTrue(first_ids.issubset({question.question_id for question in questions}))

    def test_selection_algorithm_is_reproducible_unique_and_exact(self):
        first = select_unique_candidates(
            {1: [1, 2], 2: [2, 3]},
            {1: 1, 2: 2},
            seeded_random("stable"),
        )
        second = select_unique_candidates(
            {1: [1, 2], 2: [2, 3]},
            {1: 1, 2: 2},
            seeded_random("stable"),
        )
        self.assertEqual(first, second)
        selected = [question_id for values in first.values() for question_id in values]
        self.assertEqual((len(selected), len(set(selected))), (3, 3))
        self.assertEqual(
            sum(distribute_points(Decimal("10.00"), selected).values()),
            Decimal("10.00"),
        )
        student_sets = {
            tuple(
                sorted(
                    select_unique_candidates(
                        {1: [1, 2, 3, 4]},
                        {1: 2},
                        seeded_random("exam", student_id, 1, 1),
                    )[1]
                )
            )
            for student_id in range(1, 8)
        }
        self.assertGreater(len(student_sets), 1)


if __name__ == "__main__":
    unittest.main()
