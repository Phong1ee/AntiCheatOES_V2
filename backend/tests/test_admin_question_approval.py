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
    LO,
    LOQuestion,
    MCQAnswer,
    Option,
    Question,
    QuestionRevision,
    QuestionStatus,
    Subject,
    TeacherSubject,
    User,
)
from src.middleware.authMiddleware import ADMIN_ONLY
from src.route.adminRoute import (
    RejectPayload,
    approve_pending_question,
    approve_pending_revision,
    get_pending_question_detail,
    get_question_revision_detail,
    list_pending_questions,
    list_pending_revisions,
    reject_pending_question,
    reject_pending_revision,
)
from src.route.teacherRoute.questionBankRoute import (
    QuestionBankPayload,
    QuestionOptionPayload,
    delete_question,
    update_question,
)


def option(text: str, correct: bool = False, option_id: int | None = None) -> dict:
    return {"options_id": option_id, "options_text": text, "is_correct": correct}


class AdminQuestionApprovalTests(unittest.TestCase):
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
                User(school_id="A1", full_name="Admin One", email="a1@example.test", password_hash="x", role="admin"),
                Subject(subject_id="DB", subject_name="Databases", subject_description="Database subject"),
                Subject(subject_id="WEB", subject_name="Web", subject_description="Web subject"),
            ]
        )
        self.db.flush()
        self.teacher_one = self.db.query(User).filter_by(school_id="T1").one()
        self.teacher_two = self.db.query(User).filter_by(school_id="T2").one()
        self.admin = self.db.query(User).filter_by(school_id="A1").one()
        self.db.add_all(
            [
                TeacherSubject(teacher_id=self.teacher_one.id, subject_id="DB", is_active=True),
                TeacherSubject(teacher_id=self.teacher_two.id, subject_id="DB", is_active=True),
                Chapter(chapter_id=1, chapter_name="Normalization", chapter_description="DB", subject_id="DB"),
                Chapter(chapter_id=2, chapter_name="Transactions", chapter_description="DB", subject_id="DB"),
                Chapter(chapter_id=3, chapter_name="HTML", chapter_description="WEB", subject_id="WEB"),
                LO(lo_id=10, lo_name="Analyze normal forms", lo_description="LO"),
                LO(lo_id=11, lo_name="Explain ACID", lo_description="LO"),
                LO(lo_id=12, lo_name="Use semantic tags", lo_description="LO"),
            ]
        )
        self.db.flush()
        self.db.add_all([ChapterLO(chapter_id=1, lo_id=10), ChapterLO(chapter_id=2, lo_id=11), ChapterLO(chapter_id=3, lo_id=12)])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _admin_current(self) -> dict:
        return {"school_id": "A1", "role": "admin"}

    def _teacher_current(self) -> dict:
        return {"school_id": "T1", "role": "teacher"}

    def _question(self, status: QuestionStatus = QuestionStatus.pending, text: str = "What is normalization?", owner: int | None = None) -> Question:
        question = Question(
            question_text=text,
            question_type="MCQ",
            question_difficulties="medium",
            subject_id="DB",
            created_by=owner if owner is not None else self.teacher_one.id,
            question_status=status,
        )
        self.db.add(question)
        self.db.flush()
        self.db.add_all(
            [
                Option(question_id=question.question_id, options_text="Reducing redundancy", is_correct=True),
                Option(question_id=question.question_id, options_text="Duplicating data", is_correct=False),
                ChapterQuestion(question_id=question.question_id, chapter_id=1),
                LOQuestion(question_id=question.question_id, lo_id=10),
            ]
        )
        self.db.commit()
        return self.db.get(Question, question.question_id)

    def _pending_revision(self, question: Question, editor: User | None = None, **overrides) -> QuestionRevision:
        data = {
            "question_id": question.question_id,
            "version_number": 2,
            "question_text": "Proposed normalization question",
            "question_type": "MCQ",
            "question_difficulties": "hard",
            "subject_id": "DB",
            "question_status": "pending",
            "options_snapshot": [option("Candidate key", True), option("Duplicate key")],
            "chapter_ids_snapshot": [2],
            "lo_ids_snapshot": [11],
            "edited_by": (editor or self.teacher_two).id,
        }
        data.update(overrides)
        revision = QuestionRevision(**data)
        self.db.add(revision)
        self.db.commit()
        return revision

    def _approve_question(self, question_id: int) -> dict:
        return approve_pending_question(question_id, current_user=self._admin_current(), role_check={}, db=self.db)

    def _reject_question(self, question_id: int, reason: str = "Needs more detail") -> dict:
        return reject_pending_question(question_id, RejectPayload(reason=reason), current_user=self._admin_current(), role_check={}, db=self.db)

    def _approve_revision(self, revision_id: int) -> dict:
        return approve_pending_revision(revision_id, current_user=self._admin_current(), role_check={}, db=self.db)

    def test_non_admin_is_rejected_by_the_admin_dependency_and_database_role_check(self):
        with self.assertRaises(HTTPException) as raised:
            ADMIN_ONLY({"role": "teacher"})
        self.assertEqual(raised.exception.status_code, 403)
        with self.assertRaises(HTTPException) as raised:
            list_pending_questions(current_user={"school_id": "T1", "role": "admin"}, role_check={}, db=self.db)
        self.assertEqual(raised.exception.status_code, 403)

    def test_admin_lists_and_reads_only_pending_new_questions(self):
        pending = self._question()
        self._question(QuestionStatus.approved, text="Approved")
        result = list_pending_questions(search="normal", current_user=self._admin_current(), role_check={}, db=self.db)
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["question_id"], pending.question_id)
        self.assertEqual(result["items"][0]["teacher"]["id"], self.teacher_one.id)
        self.assertEqual(len(result["items"][0]["options"]), 2)
        detail = get_pending_question_detail(pending.question_id, current_user=self._admin_current(), role_check={}, db=self.db)
        self.assertEqual(detail["chapters"][0]["chapter_id"], 1)
        with self.assertRaises(HTTPException) as raised:
            get_pending_question_detail(pending.question_id + 1, current_user=self._admin_current(), role_check={}, db=self.db)
        self.assertEqual(raised.exception.status_code, 404)

    def test_approve_new_question_creates_one_approved_baseline_and_preserves_latest_content(self):
        question = self._question(text="Initial pending text")
        question.question_text = "Latest pending text"
        self.db.commit()
        result = self._approve_question(question.question_id)
        approved = self.db.get(Question, question.question_id)
        baseline = self.db.query(QuestionRevision).one()
        self.assertEqual(result["question_status"], "approved")
        self.assertEqual(approved.question_text, "Latest pending text")
        self.assertEqual(baseline.version_number, 1)
        self.assertEqual(baseline.question_status, "approved")
        self.assertEqual(baseline.edited_by, self.teacher_one.id)
        self.assertEqual(baseline.approved_by, self.admin.id)
        self.assertIsNotNone(baseline.approved_at)
        with self.assertRaises(HTTPException) as raised:
            self._approve_question(question.question_id)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(self.db.query(QuestionRevision).count(), 1)

    def test_reject_new_question_requires_reason_and_persists_review_audit(self):
        question = self._question()
        with self.assertRaises(HTTPException) as raised:
            self._reject_question(question.question_id, "   ")
        self.assertEqual(raised.exception.status_code, 400)
        self._reject_question(question.question_id, "Clarify the wording")
        rejected = self.db.get(Question, question.question_id)
        audit = self.db.query(QuestionRevision).one()
        self.assertEqual(rejected.question_status, QuestionStatus.rejected)
        self.assertEqual(audit.question_status, "rejected")
        self.assertEqual(audit.rejection_reason, "Clarify the wording")
        self.assertEqual(audit.approved_by, self.admin.id)
        self.assertIsNotNone(audit.approved_at)
        self.assertEqual(self.db.query(Option).filter_by(question_id=question.question_id).count(), 2)

    def test_reapproval_after_resubmission_clears_previous_rejection_feedback(self):
        question = self._question()
        self._reject_question(question.question_id, "Needs a clearer stem")
        question.question_status = QuestionStatus.pending
        self.db.commit()
        self._approve_question(question.question_id)
        revisions = self.db.query(QuestionRevision).filter_by(question_id=question.question_id).order_by(QuestionRevision.version_number).all()
        self.assertEqual([item.question_status for item in revisions], ["rejected", "approved"])
        self.assertIsNone(revisions[0].rejection_reason)
        self.assertEqual(revisions[1].version_number, 2)

    def test_deleted_or_already_processed_new_question_cannot_be_reviewed(self):
        question = self._question()
        self.db.query(Option).filter_by(question_id=question.question_id).delete()
        self.db.query(ChapterQuestion).filter_by(question_id=question.question_id).delete()
        self.db.query(LOQuestion).filter_by(question_id=question.question_id).delete()
        self.db.delete(question)
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            self._approve_question(question.question_id)
        self.assertEqual(raised.exception.status_code, 404)
        question = self._question()
        self._reject_question(question.question_id)
        with self.assertRaises(HTTPException) as raised:
            self._reject_question(question.question_id)
        self.assertEqual(raised.exception.status_code, 409)

    def test_admin_lists_pending_revisions_and_returns_active_and_proposed_detail(self):
        question = self._question(QuestionStatus.approved)
        revision = self._pending_revision(question)
        result = list_pending_revisions(search="proposed", current_user=self._admin_current(), role_check={}, db=self.db)
        self.assertEqual(result["total"], 1)
        item = result["items"][0]
        self.assertEqual(item["proposed_revision"]["revision_id"], revision.revision_id)
        self.assertEqual(item["active_question"]["question_text"], "What is normalization?")
        detail = get_question_revision_detail(revision.revision_id, current_user=self._admin_current(), role_check={}, db=self.db)
        self.assertEqual(detail["active_question"]["question_id"], question.question_id)
        self.assertEqual(detail["proposed_revision"]["chapter_ids"], [2])
        self.assertEqual(detail["proposed_revision"]["subject"]["subject_name"], "Databases")
        self.assertEqual(detail["proposed_revision"]["learning_objectives"][0]["lo_name"], "Explain ACID")

    def test_approve_pending_revision_applies_all_snapshot_fields_and_marks_revision_approved(self):
        question = self._question(QuestionStatus.approved)
        revision = self._pending_revision(question)
        result = self._approve_revision(revision.revision_id)
        active = self.db.get(Question, question.question_id)
        applied = self.db.get(QuestionRevision, revision.revision_id)
        self.assertEqual(active.question_status, QuestionStatus.approved)
        self.assertEqual(active.question_text, "Proposed normalization question")
        self.assertEqual(str(active.question_type), "QuestionType.MCQ")
        self.assertEqual(str(active.question_difficulties), "QuestionDifficulty.hard")
        self.assertEqual(active.subject_id, "DB")
        self.assertEqual([link.chapter_id for link in active.chapter_questions], [2])
        self.assertEqual([link.lo_id for link in active.lo_questions], [11])
        self.assertEqual(sorted(item.options_text for item in active.options), ["Candidate key", "Duplicate key"])
        self.assertEqual(applied.question_status, "approved")
        self.assertEqual(applied.approved_by, self.admin.id)
        self.assertIsNotNone(applied.approved_at)
        self.assertEqual(result["active_question"]["question_status"], "approved")

    def test_reject_pending_revision_keeps_active_question_options_and_taxonomy_unchanged(self):
        question = self._question(QuestionStatus.approved)
        revision = self._pending_revision(question)
        reject_pending_revision(revision.revision_id, RejectPayload(reason="Use clearer terms"), current_user=self._admin_current(), role_check={}, db=self.db)
        active = self.db.get(Question, question.question_id)
        rejected = self.db.get(QuestionRevision, revision.revision_id)
        self.assertEqual(active.question_text, "What is normalization?")
        self.assertEqual([link.chapter_id for link in active.chapter_questions], [1])
        self.assertEqual(sorted(item.options_text for item in active.options), ["Duplicating data", "Reducing redundancy"])
        self.assertEqual(rejected.question_status, "rejected")
        self.assertEqual(rejected.rejection_reason, "Use clearer terms")
        with self.assertRaises(HTTPException) as raised:
            self._approve_revision(revision.revision_id)
        self.assertEqual(raised.exception.status_code, 409)

    def test_revision_apply_rolls_back_when_snapshot_taxonomy_is_invalid(self):
        question = self._question(QuestionStatus.approved)
        revision = self._pending_revision(question, chapter_ids_snapshot=[3], lo_ids_snapshot=[12])
        with self.assertRaises(HTTPException) as raised:
            self._approve_revision(revision.revision_id)
        self.assertEqual(raised.exception.status_code, 400)
        active = self.db.get(Question, question.question_id)
        self.assertEqual(active.question_text, "What is normalization?")
        self.assertEqual([link.chapter_id for link in active.chapter_questions], [1])
        self.assertEqual(self.db.get(QuestionRevision, revision.revision_id).question_status, "pending")

    def test_revision_rejects_foreign_option_id_and_rolls_back(self):
        question = self._question(QuestionStatus.approved)
        other = self._question(QuestionStatus.approved, text="Other question")
        foreign_option_id = other.options[0].options_id
        revision = self._pending_revision(question, options_snapshot=[option("Foreign", True, foreign_option_id), option("New")])
        with self.assertRaises(HTTPException) as raised:
            self._approve_revision(revision.revision_id)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(sorted(item.options_text for item in self.db.get(Question, question.question_id).options), ["Duplicating data", "Reducing redundancy"])
        self.assertEqual(self.db.get(QuestionRevision, revision.revision_id).question_status, "pending")

    def test_revision_cannot_delete_an_option_referenced_by_an_attempt(self):
        question = self._question(QuestionStatus.approved)
        retained = question.options[0]
        attempt = Attempt(exam_id=None, student_id=self.teacher_one.id, attempt_no=1)
        self.db.add(attempt)
        self.db.flush()
        self.db.add(AttemptQuestion(attempt_id=attempt.attempt_id, question_id=question.question_id, display_order=1))
        self.db.add(MCQAnswer(attempt_id=attempt.attempt_id, question_id=question.question_id, selected_option_id=retained.options_id))
        self.db.commit()
        revision = self._pending_revision(question, options_snapshot=[option("Replacement A", True), option("Replacement B")])
        with self.assertRaises(HTTPException) as raised:
            self._approve_revision(revision.revision_id)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(self.db.get(QuestionRevision, revision.revision_id).question_status, "pending")
        self.assertEqual(self.db.get(Question, question.question_id).question_text, "What is normalization?")

    def test_pending_teacher_update_before_review_is_the_content_admin_approves_or_rejects(self):
        question = self._question()
        payload = QuestionBankPayload(
            question_text="Teacher's latest pending edit",
            question_type="MCQ",
            question_difficulties="hard",
            subject_id="DB",
            chapter_ids=[2],
            lo_ids=[11],
            options=[QuestionOptionPayload(options_text="ACID", is_correct=True), QuestionOptionPayload(options_text="BASE")],
        )
        update_question(question.question_id, payload, self._teacher_current(), {}, self.db, expected_status="pending")
        self._approve_question(question.question_id)
        active = self.db.get(Question, question.question_id)
        self.assertEqual(active.question_text, "Teacher's latest pending edit")
        self.assertEqual([link.chapter_id for link in active.chapter_questions], [2])
        question = self._question(text="Pending to reject")
        question.question_text = "Latest rejected text"
        self.db.commit()
        self._reject_question(question.question_id)
        self.assertEqual(self.db.get(Question, question.question_id).question_text, "Latest rejected text")

    def test_expected_pending_operations_conflict_after_admin_processes_question(self):
        question = self._question()
        self._approve_question(question.question_id)
        payload = QuestionBankPayload(
            question_text="Stale edit",
            question_type="MCQ",
            question_difficulties="medium",
            subject_id="DB",
            chapter_ids=[1],
            lo_ids=[10],
            options=[QuestionOptionPayload(options_text="A", is_correct=True), QuestionOptionPayload(options_text="B")],
        )
        with self.assertRaises(HTTPException) as raised:
            update_question(question.question_id, payload, self._teacher_current(), {}, self.db, expected_status="pending")
        self.assertEqual(raised.exception.status_code, 409)
        with self.assertRaises(HTTPException) as raised:
            delete_question(question.question_id, self._teacher_current(), {}, self.db, expected_status="pending")
        self.assertEqual(raised.exception.status_code, 409)
