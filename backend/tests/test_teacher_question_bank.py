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
    Exam,
    ExamQuestion,
    LO,
    LOQuestion,
    Option,
    Question,
    QuestionRevision,
    QuestionStatus,
    Subject,
    TeacherSubject,
    User,
)
from src.route.teacherRoute.questionBankRoute import (
    QuestionBankPayload,
    QuestionOptionPayload,
    create_draft_question,
    delete_pending_revision,
    delete_question,
    get_question_edit_payload,
    get_question_detail,
    list_approved_question_bank,
    list_my_questions,
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

    def _create(self, payload: QuestionBankPayload | None = None, school_id: str = "T1") -> dict:
        return create_draft_question(payload or self._payload(), self._current(school_id), {}, self.db)

    def _pending(self, school_id: str = "T1") -> dict:
        result = self._create(school_id=school_id)
        submit_question(result["question_id"], self._current(school_id), {}, self.db)
        return result

    def _approved(self, created_by: int | None = None) -> dict:
        result = self._create()
        question = self.db.get(Question, result["question_id"])
        if created_by is not None:
            question.created_by = created_by
        question.question_status = QuestionStatus.approved
        self.db.commit()
        return result

    def test_save_draft_updates_question_options_and_taxonomy_directly(self):
        created = self._create()
        update_question(
            created["question_id"],
            self._payload(question_text="Updated draft", chapter_ids=[2], lo_ids=[11], options=[option("ACID", True), option("CAP")]),
            self._current(), {}, self.db,
        )
        question = self.db.get(Question, created["question_id"])
        self.assertEqual(question.question_status, QuestionStatus.draft)
        self.assertEqual(question.question_text, "Updated draft")
        self.assertEqual([link.chapter_id for link in question.chapter_questions], [2])
        self.assertEqual([link.lo_id for link in question.lo_questions], [11])
        self.assertEqual(sorted(item.options_text for item in question.options), ["ACID", "CAP"])
        self.assertEqual(self.db.query(QuestionRevision).count(), 0)

    def test_submit_and_pending_owner_permissions_allow_edit_delete(self):
        created = self._pending()
        mine = list_my_questions(current_user=self._current(), role_check={}, db=self.db)
        item = mine["items"][0]
        self.assertEqual(item["question_id"], created["question_id"])
        self.assertEqual(item["question_status"], "pending")
        self.assertTrue(item["permissions"]["can_edit"])
        self.assertTrue(item["permissions"]["can_delete"])
        self.assertFalse(item["permissions"]["can_submit"])
        self.assertFalse(item["permissions"]["can_resubmit"])
        self.assertEqual(get_question_detail(created["question_id"], self._current(), {}, self.db)["question_id"], created["question_id"])

    def test_pending_edit_updates_active_question_without_revision_or_status_change(self):
        created = self._pending()
        update_question(
            created["question_id"],
            self._payload(question_text="Latest pending text", chapter_ids=[2], lo_ids=[11], options=[option("ACID", True), option("BASE")]),
            self._current(), {}, self.db,
        )
        question = self.db.get(Question, created["question_id"])
        self.assertEqual(question.question_status, QuestionStatus.pending)
        self.assertEqual(question.question_text, "Latest pending text")
        self.assertEqual([link.chapter_id for link in question.chapter_questions], [2])
        self.assertEqual([link.lo_id for link in question.lo_questions], [11])
        self.assertEqual(self.db.query(QuestionRevision).count(), 0)

    def test_pending_question_rejects_other_teacher_and_missing_subject_permission(self):
        created = self._pending()
        with self.assertRaises(HTTPException) as raised:
            update_question(created["question_id"], self._payload(), self._current("T2"), {}, self.db)
        self.assertEqual(raised.exception.status_code, 404)
        self.db.query(TeacherSubject).filter_by(teacher_id=self.teacher_one.id, subject_id="DB").update({"is_active": False})
        self.db.commit()
        mine = list_my_questions(current_user=self._current(), role_check={}, db=self.db)
        self.assertFalse(mine["items"][0]["permissions"]["can_edit"])
        self.assertFalse(mine["items"][0]["permissions"]["can_delete"])
        with self.assertRaises(HTTPException) as raised:
            update_question(created["question_id"], self._payload(), self._current(), {}, self.db, expected_status="pending")
        self.assertEqual(raised.exception.status_code, 403)

    def test_pending_delete_removes_question_and_relations(self):
        created = self._pending()
        response = delete_question(created["question_id"], self._current(), {}, self.db)
        self.assertEqual(response.status_code, 204)
        self.assertIsNone(self.db.get(Question, created["question_id"]))
        self.assertEqual(self.db.query(Option).count(), 0)
        self.assertEqual(self.db.query(LOQuestion).count(), 0)

    def test_pending_delete_conflicts_when_exam_or_attempt_references_question(self):
        created = self._pending()
        exam = self.db.query(Exam).filter_by(examcode="MID").one()
        self.db.add(ExamQuestion(exam_id=exam.exam_id, question_id=created["question_id"], question_point=5))
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            delete_question(created["question_id"], self._current(), {}, self.db, expected_status="pending")
        self.assertEqual(raised.exception.status_code, 409)
        self.db.query(ExamQuestion).delete()
        attempt = Attempt(exam_id=exam.exam_id, student_id=self.teacher_one.id, attempt_no=1)
        self.db.add(attempt)
        self.db.flush()
        self.db.add(AttemptQuestion(attempt_id=attempt.attempt_id, question_id=created["question_id"], display_order=1))
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            delete_question(created["question_id"], self._current(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 409)

    def test_pending_operations_conflict_if_status_changed_before_lock(self):
        created = self._pending()
        question = self.db.get(Question, created["question_id"])
        question.question_status = QuestionStatus.approved
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            update_question(created["question_id"], self._payload(), self._current(), {}, self.db, expected_status="pending")
        self.assertEqual(raised.exception.status_code, 409)
        with self.assertRaises(HTTPException) as raised:
            delete_question(created["question_id"], self._current(), {}, self.db, expected_status="pending")
        self.assertEqual(raised.exception.status_code, 409)

    def test_rejected_new_question_can_update_and_resubmit(self):
        created = self._create()
        question = self.db.get(Question, created["question_id"])
        question.question_status = QuestionStatus.rejected
        self.db.commit()
        update_question(created["question_id"], self._payload(question_text="Fixed question"), self._current(), {}, self.db)
        submit_question(created["question_id"], self._current(), {}, self.db)
        self.assertEqual(self.db.get(Question, created["question_id"]).question_status, QuestionStatus.pending)

    def test_approved_edit_creates_and_then_updates_one_pending_revision_without_changing_active_question(self):
        created = self._approved()
        active = self.db.get(Question, created["question_id"])
        active_option_texts = sorted(item.options_text for item in active.options)
        update_question(
            created["question_id"],
            self._payload(question_text="Proposed v2", chapter_ids=[2], lo_ids=[11], options=[option("New A", True), option("New B")]),
            self._current(), {}, self.db,
        )
        active = self.db.get(Question, created["question_id"])
        self.assertEqual(active.question_status, QuestionStatus.approved)
        self.assertEqual(active.question_text, "What is normalization?")
        self.assertEqual(sorted(item.options_text for item in active.options), active_option_texts)
        self.assertEqual([link.chapter_id for link in active.chapter_questions], [1])
        revision = self.db.query(QuestionRevision).one()
        self.assertEqual(revision.question_status, "pending")
        self.assertEqual(revision.version_number, 1)
        self.assertEqual(revision.question_text, "Proposed v2")
        revision_id = revision.revision_id
        update_question(created["question_id"], self._payload(question_text="Proposed v2 revised"), self._current(), {}, self.db)
        revision = self.db.query(QuestionRevision).one()
        self.assertEqual(revision.revision_id, revision_id)
        self.assertEqual(revision.version_number, 1)
        self.assertEqual(revision.question_text, "Proposed v2 revised")

        pending_view = list_my_questions(status_filter="pending", current_user=self._current(), role_check={}, db=self.db)
        approved_view = list_my_questions(status_filter="approved", current_user=self._current(), role_check={}, db=self.db)
        self.assertEqual([item["question_id"] for item in pending_view["items"]], [created["question_id"]])
        self.assertTrue(pending_view["items"][0]["has_pending_revision"])
        self.assertEqual(approved_view["items"], [])

    def test_teacher_with_subject_permission_can_edit_admin_created_approved_question(self):
        created = self._approved(created_by=self.admin.id)
        update_question(created["question_id"], self._payload(question_text="Teacher proposal"), self._current(), {}, self.db)
        active = self.db.get(Question, created["question_id"])
        revision = self.db.query(QuestionRevision).one()
        self.assertEqual(active.created_by, self.admin.id)
        self.assertEqual(active.question_status, QuestionStatus.approved)
        self.assertEqual(active.question_text, "What is normalization?")
        self.assertEqual(revision.edited_by, self.teacher_one.id)
        self.assertEqual(revision.question_status, "pending")

    def test_teacher_with_subject_permission_can_edit_other_teachers_approved_question(self):
        created = self._approved()
        update_question(created["question_id"], self._payload(question_text="Teacher two proposal"), self._current("T2"), {}, self.db)
        revision = self.db.query(QuestionRevision).one()
        self.assertEqual(revision.edited_by, self.teacher_two.id)
        self.assertEqual(revision.question_text, "Teacher two proposal")

    def test_approved_edit_requires_subject_permission_even_for_the_owner(self):
        created = self._approved()
        self.db.query(TeacherSubject).filter_by(teacher_id=self.teacher_one.id, subject_id="DB").update({"is_active": False})
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            update_question(created["question_id"], self._payload(question_text="Blocked"), self._current(), {}, self.db)
        self.assertEqual(raised.exception.status_code, 403)
        bank = list_approved_question_bank(current_user=self._current(), role_check={}, db=self.db)
        self.assertFalse(bank["items"][0]["permissions"]["can_edit"])

    def test_question_bank_returns_edit_permission_for_authorized_approved_question(self):
        self._approved(created_by=self.admin.id)
        bank = list_approved_question_bank(current_user=self._current("T2"), role_check={}, db=self.db)
        self.assertTrue(bank["items"][0]["permissions"]["can_edit"])
        self.assertFalse(bank["items"][0]["permissions"]["can_delete"])

    def test_edit_payload_returns_pending_revision_or_active_approved_question(self):
        created = self._approved()
        active_payload = get_question_edit_payload(created["question_id"], self._current(), {}, self.db)
        self.assertIsNone(active_payload["revision_id"])
        self.assertEqual(active_payload["question_text"], "What is normalization?")
        update_question(created["question_id"], self._payload(question_text="Proposed"), self._current(), {}, self.db)
        pending_payload = get_question_edit_payload(created["question_id"], self._current(), {}, self.db)
        self.assertTrue(pending_payload["has_pending_revision"])
        self.assertEqual(pending_payload["question_status"], "pending")
        self.assertEqual(pending_payload["question_text"], "Proposed")

    def test_owner_can_delete_pending_revision_without_affecting_active_question(self):
        created = self._approved()
        update_question(created["question_id"], self._payload(question_text="Proposed"), self._current(), {}, self.db)
        response = delete_pending_revision(created["question_id"], self._current(), {}, self.db)
        self.assertEqual(response.status_code, 204)
        active = self.db.get(Question, created["question_id"])
        self.assertEqual(active.question_status, QuestionStatus.approved)
        self.assertEqual(active.question_text, "What is normalization?")
        self.assertEqual(self.db.query(QuestionRevision).count(), 0)

    def test_pending_revisions_are_private_to_their_editor_but_authorized_teachers_can_propose_their_own(self):
        created = self._approved()
        update_question(created["question_id"], self._payload(question_text="Proposed"), self._current(), {}, self.db)
        edit_payload = get_question_edit_payload(created["question_id"], self._current("T2"), {}, self.db)
        self.assertFalse(edit_payload["has_pending_revision"])
        self.assertEqual(edit_payload["question_text"], "What is normalization?")
        with self.assertRaises(HTTPException) as raised:
            delete_pending_revision(created["question_id"], self._current("T2"), {}, self.db)
        self.assertEqual(raised.exception.status_code, 404)
        update_question(created["question_id"], self._payload(question_text="Teacher two proposal"), self._current("T2"), {}, self.db)
        revisions = self.db.query(QuestionRevision).order_by(QuestionRevision.edited_by).all()
        self.assertEqual([item.edited_by for item in revisions], [self.teacher_one.id, self.teacher_two.id])

    def test_rejected_revision_is_retained_and_next_approved_edit_creates_next_pending_version(self):
        created = self._approved()
        rejected = QuestionRevision(
            question_id=created["question_id"], version_number=1, question_text="Rejected proposal", question_type="MCQ",
            question_difficulties="medium", subject_id="DB", question_status="rejected", options_snapshot=[],
            chapter_ids_snapshot=[], lo_ids_snapshot=[], edited_by=self.teacher_one.id, rejection_reason="Needs clarity",
        )
        self.db.add(rejected)
        self.db.commit()
        rejected_payload = get_question_edit_payload(created["question_id"], self._current(), {}, self.db, revision_id=rejected.revision_id)
        self.assertEqual(rejected_payload["question_status"], "rejected")
        self.assertEqual(rejected_payload["rejection_reason"], "Needs clarity")
        update_question(created["question_id"], self._payload(question_text="New proposal"), self._current(), {}, self.db)
        revisions = self.db.query(QuestionRevision).order_by(QuestionRevision.version_number).all()
        self.assertEqual([(item.version_number, item.question_status) for item in revisions], [(1, "rejected"), (2, "pending")])
        self.assertEqual(revisions[0].rejection_reason, "Needs clarity")

    def test_rejected_revision_is_listed_as_rejected_and_can_be_loaded_for_resubmission(self):
        created = self._approved()
        rejected = QuestionRevision(
            question_id=created["question_id"], version_number=1, question_text="Rejected proposal", question_type="MCQ",
            question_difficulties="medium", subject_id="DB", question_status="rejected", options_snapshot=[],
            chapter_ids_snapshot=[], lo_ids_snapshot=[], edited_by=self.teacher_one.id, rejection_reason="Needs clarity",
        )
        self.db.add(rejected)
        self.db.commit()

        rejected_view = list_my_questions(status_filter="rejected", current_user=self._current(), role_check={}, db=self.db)
        approved_view = list_my_questions(status_filter="approved", current_user=self._current(), role_check={}, db=self.db)
        edit_payload = get_question_edit_payload(created["question_id"], self._current(), {}, self.db)

        self.assertEqual([item["question_id"] for item in rejected_view["items"]], [created["question_id"]])
        self.assertEqual(rejected_view["items"][0]["revision_rejection_reason"], "Needs clarity")
        self.assertEqual(approved_view["items"], [])
        self.assertEqual(edit_payload["revision_id"], rejected.revision_id)
        self.assertEqual(edit_payload["question_status"], "rejected")

    def test_question_bank_still_returns_active_approved_question(self):
        created = self._approved()
        update_question(created["question_id"], self._payload(question_text="Unapproved proposed text"), self._current(), {}, self.db)
        bank = list_approved_question_bank(current_user=self._current("T2"), role_check={}, db=self.db)
        self.assertEqual(bank["items"][0]["question_text"], "What is normalization?")

    def test_subject_permission_required_for_create_and_subject_change(self):
        self.db.query(TeacherSubject).filter_by(teacher_id=self.teacher_one.id, subject_id="DB").update({"is_active": False})
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            self._create()
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
