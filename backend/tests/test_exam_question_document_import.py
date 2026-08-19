"""How a filled template resolves against the Question Bank.

Re-typed questions are the normal case, so the import matches on text before it
creates anything: identical content reuses the bank question, changed content is
an edit of it, and only genuinely new text becomes a new draft.
"""

import unittest
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.a_db_config import (
    Base,
    Chapter,
    ChapterLO,
    ChapterQuestion,
    Exam,
    ExamQuestion,
    ExamStatus,
    LO,
    LOQuestion,
    Option,
    Question,
    QuestionRevision,
    Subject,
    User,
    UserRole,
)
from src.service.exam_question_import_service import DEFAULT_QUESTION_POINT, apply_document_import
from src.service.question_bank_import_parser import ParsedOption, ParsedQuestion


def parsed(text, *, kind="MCQ", difficulty="easy", options=(("Yes", True), ("No", False)),
           chapter="Chapter 1", los=("Objective 1",)):
    return ParsedQuestion(
        question_number=1,
        chapter_name=chapter,
        learning_objective_names=list(los),
        question_type=kind,
        difficulty=difficulty,
        question_text=text,
        options=[ParsedOption(label=chr(65 + i), option_text=t, is_correct=c) for i, (t, c) in enumerate(options)],
    )


class ExamQuestionDocumentImportTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(Subject(subject_id="NET204", subject_name="Networking", subject_description="d"))
        self.teacher = User(
            school_id="T1", full_name="Teacher", email="t1@example.edu",
            password_hash="x", role=UserRole.teacher,
        )
        self.other = User(
            school_id="T2", full_name="Other", email="t2@example.edu",
            password_hash="x", role=UserRole.teacher,
        )
        self.db.add_all([self.teacher, self.other])
        self.exam = Exam(title="Midterm", subject_id="NET204", status=ExamStatus.draft, manage_by="T1")
        self.db.add(self.exam)
        self.db.flush()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _bank_question(self, text, *, status="approved", created_by="T2", kind="MCQ",
                       difficulty="easy", options=(("Yes", True), ("No", False))):
        question = Question(
            question_text=text, question_type=kind, question_difficulties=difficulty,
            subject_id="NET204", created_by=created_by, question_status=status,
        )
        self.db.add(question)
        self.db.flush()
        for text_value, correct in options:
            self.db.add(Option(question_id=question.question_id, options_text=text_value, is_correct=correct))
        self.db.flush()
        return question

    def _run(self, questions):
        return apply_document_import(self.db, self.exam, self.teacher, questions)

    def _links(self):
        return self.db.query(ExamQuestion).filter(ExamQuestion.exam_id == self.exam.exam_id).all()

    def test_identical_question_is_reused_not_copied(self):
        existing = self._bank_question("What is TCP?")

        summary = self._run([parsed("What is TCP?")])

        self.assertEqual(summary["reused"], 1)
        self.assertEqual(summary["created"], 0)
        self.assertEqual(self.db.query(Question).count(), 1)
        self.assertEqual([link.question_id for link in self._links()], [existing.question_id])

    def test_matching_ignores_wording_noise_and_option_order(self):
        existing = self._bank_question("What is TCP?")

        summary = self._run([parsed("  what   is TCP?  ", options=(("No", False), ("Yes", True)))])

        self.assertEqual(summary["reused"], 1)
        self.assertEqual([link.question_id for link in self._links()], [existing.question_id])

    def test_same_text_different_content_proposes_an_edit(self):
        existing = self._bank_question("What is TCP?", difficulty="easy")

        summary = self._run([parsed("What is TCP?", difficulty="hard")])

        self.assertEqual(summary["proposed_edit"], 1)
        self.assertEqual(summary["created"], 0)
        revisions = self.db.query(QuestionRevision).all()
        self.assertEqual(len(revisions), 1)
        self.assertEqual(revisions[0].question_id, existing.question_id)
        self.assertEqual(revisions[0].edited_by, "T1")
        self.assertEqual(revisions[0].question_status, "pending")
        self.assertEqual(revisions[0].question_difficulties, "hard")
        # The approved wording stays in the exam until the proposal is approved.
        self.assertEqual(existing.question_difficulties, "easy")
        self.assertEqual([link.question_id for link in self._links()], [existing.question_id])

    def test_a_second_import_updates_the_same_proposal(self):
        self._bank_question("What is TCP?", difficulty="easy")

        self._run([parsed("What is TCP?", difficulty="hard")])
        self._run([parsed("What is TCP?", difficulty="medium")])

        revisions = self.db.query(QuestionRevision).all()
        self.assertEqual(len(revisions), 1)
        self.assertEqual(revisions[0].question_difficulties, "medium")

    def test_edit_to_own_draft_is_applied_directly(self):
        own = self._bank_question("Explain routing", status="draft", created_by="T1", difficulty="easy")

        summary = self._run([parsed("Explain routing", difficulty="hard")])

        self.assertEqual(summary["updated_own"], 1)
        self.assertEqual(self.db.query(QuestionRevision).count(), 0)
        self.assertEqual(own.question_difficulties, "hard")

    def test_new_text_creates_a_draft_owned_by_the_importer(self):
        summary = self._run([parsed("Brand new question")])

        self.assertEqual(summary["created"], 1)
        created = self.db.query(Question).one()
        self.assertEqual(created.question_status, "draft")
        self.assertEqual(created.created_by, "T1")
        self.assertEqual(created.subject_id, "NET204")
        self.assertEqual({option.options_text for option in created.options}, {"Yes", "No"})

    def test_another_teachers_draft_is_not_matched(self):
        self._bank_question("Private draft", status="draft", created_by="T2")

        summary = self._run([parsed("Private draft")])

        self.assertEqual(summary["created"], 1)
        self.assertEqual(self.db.query(Question).count(), 2)

    def test_questions_are_attached_with_an_adjustable_default_point(self):
        self._run([parsed("Q one"), parsed("Q two", chapter="Chapter 2")])

        links = self._links()
        self.assertEqual(len(links), 2)
        self.assertTrue(all(Decimal(str(link.question_point)) == DEFAULT_QUESTION_POINT for link in links))

    def test_a_question_already_in_the_exam_is_not_attached_twice(self):
        existing = self._bank_question("What is TCP?")
        self.db.add(ExamQuestion(exam_id=self.exam.exam_id, question_id=existing.question_id, question_point=5))
        self.db.flush()

        summary = self._run([parsed("What is TCP?")])

        self.assertEqual(summary["already_in_exam"], 1)
        self.assertEqual(summary["attached"], 0)
        links = self._links()
        self.assertEqual(len(links), 1)
        # An existing link keeps the points the teacher already set.
        self.assertEqual(Decimal(str(links[0].question_point)), Decimal("5"))

    def test_missing_chapters_and_objectives_are_created_once(self):
        self._run([
            parsed("Q one", chapter="New Chapter", los=("New Objective",)),
            parsed("Q two", chapter="new   chapter", los=("NEW OBJECTIVE",)),
        ])

        chapters = self.db.query(Chapter).filter(Chapter.subject_id == "NET204").all()
        self.assertEqual([chapter.chapter_name for chapter in chapters], ["New Chapter"])
        self.assertEqual(self.db.query(LO).count(), 1)
        self.assertEqual(self.db.query(ChapterLO).count(), 1)
        self.assertEqual(self.db.query(ChapterQuestion).count(), 2)
        self.assertEqual(self.db.query(LOQuestion).count(), 2)

    def test_existing_chapter_is_reused_by_name(self):
        chapter = Chapter(chapter_name="Chapter 1", chapter_description="d", subject_id="NET204")
        self.db.add(chapter)
        self.db.flush()

        self._run([parsed("Q one", chapter="chapter 1")])

        self.assertEqual(self.db.query(Chapter).count(), 1)
        link = self.db.query(ChapterQuestion).one()
        self.assertEqual(link.chapter_id, chapter.chapter_id)

    def test_repeated_text_within_one_file_is_created_once(self):
        summary = self._run([parsed("Repeated"), parsed("Repeated")])

        self.assertEqual(summary["created"], 1)
        self.assertEqual(summary["reused"], 1)
        self.assertEqual(self.db.query(Question).count(), 1)


if __name__ == "__main__":
    unittest.main()
