import unittest
from copy import deepcopy
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch

from src.models.teacher import examModel


def essay_question(question_id: int) -> dict:
    return {
        "question_id": question_id,
        "question_point": Decimal("5"),
        "question_type_snapshot": "essay",
        "question_point_snapshot": Decimal("5"),
        "options_snapshot": [],
        "question_type": "essay",
    }


def objective_question(question_id: int, maximum: str, question_type: str = "MCQ") -> dict:
    return {
        "question_id": question_id,
        "display_order": question_id,
        "question_point": Decimal(maximum),
        "question_type_snapshot": question_type,
        "question_point_snapshot": Decimal(maximum),
        "options_snapshot": [
            {"id": question_id * 10 + 1, "text": "Correct", "isCorrect": True},
            {"id": question_id * 10 + 2, "text": "Incorrect", "isCorrect": False},
        ],
        "question_type": question_type,
    }


class _EssayCursor:
    def __init__(self, questions: list[dict], existing: dict[int, dict] | None = None):
        self.questions = questions
        self.essays = existing or {}
        self.mcqs: dict[int, int] = {}
        self.attempt = {
            "status": "in_progress",
            "submitted_at": None,
            "end_time": None,
            "score": Decimal("0"),
            "student_id": "S1",
        }
        self.fetchone_value = None
        self.fetchall_value = []
        self.final_score = None
        self.outbox_events: list[tuple] = []
        self.fail_outbox = False
        self.fail_attempt_update = False

    def execute(self, query, params=()):
        normalized = " ".join(query.split())
        self.fetchone_value = None
        self.fetchall_value = []
        if normalized.startswith("SELECT status, submitted_at"):
            self.fetchone_value = dict(self.attempt)
        elif normalized.startswith("SELECT sequential_navigation"):
            self.fetchone_value = {"sequential_navigation": False}
        elif "FROM attempt_question aq" in normalized:
            self.fetchall_value = list(self.questions)
        elif normalized.startswith("SELECT answer_text, score FROM essay_answers"):
            self.fetchone_value = self.essays.get(int(params[1]))
        elif normalized.startswith("INSERT INTO essay_answers"):
            _, question_id, answer_text, score = params
            self.essays[int(question_id)] = {"answer_text": answer_text, "score": score}
        elif normalized.startswith("UPDATE essay_answers SET answer_text"):
            _answer_text, _attempt_id, question_id = params
            self.essays[int(question_id)]["answer_text"] = _answer_text
        elif normalized.startswith("UPDATE essay_answers SET score = 0"):
            for answer in self.essays.values():
                if answer["score"] is None:
                    answer["score"] = 0
        elif normalized.startswith("INSERT INTO mcq_answers"):
            _, question_id, option_id = params
            self.mcqs[int(question_id)] = int(option_id)
        elif normalized.startswith("SELECT question_id, selected_option_id"):
            self.fetchall_value = [
                {"question_id": question_id, "selected_option_id": option_id}
                for question_id, option_id in self.mcqs.items()
            ]
        elif normalized.startswith("SELECT question_id, score FROM essay_answers"):
            self.fetchall_value = [
                {"question_id": question_id, "score": answer["score"]}
                for question_id, answer in self.essays.items()
            ]
        elif normalized.startswith("SELECT COUNT(*) AS pending"):
            self.fetchone_value = {
                "pending": sum(1 for answer in self.essays.values() if answer["score"] is None)
            }
        elif normalized.startswith("UPDATE attempt SET score"):
            if self.fail_attempt_update:
                raise RuntimeError("attempt update failed")
            score, status, _reason, submit_request_id, _attempt_id = params
            self.attempt.update(
                score=score,
                status=status,
                submitted_at=datetime(2026, 8, 3, 10, 0),
                end_time=datetime(2026, 8, 3, 10, 0),
                submit_request_id=submit_request_id,
            )
        elif normalized.startswith("SELECT result_strategy"):
            self.fetchone_value = {"result_strategy": "highest"}
        elif normalized.startswith("SELECT score FROM attempt"):
            self.fetchall_value = [{"score": self.attempt["score"]}]
        elif normalized.startswith("UPDATE student_exam SET final_score"):
            self.final_score = params[0]
        elif normalized.startswith("INSERT INTO exam_event"):
            return
        elif normalized.startswith("INSERT INTO outbox_event"):
            if self.fail_outbox:
                raise RuntimeError("outbox insert failed")
            self.outbox_events.append(params)
        else:
            raise AssertionError(f"Unexpected SQL: {normalized}")

    def fetchone(self):
        return self.fetchone_value

    def fetchall(self):
        return self.fetchall_value

    def close(self):
        pass


class _EssayConnection:
    def __init__(self, cursor: _EssayCursor):
        self.cursor_instance = cursor
        self.commits = 0
        self.rollbacks = 0
        self.snapshot = None

    def cursor(self, **_kwargs):
        return self.cursor_instance

    def start_transaction(self):
        self.snapshot = {
            "attempt": deepcopy(self.cursor_instance.attempt),
            "essays": deepcopy(self.cursor_instance.essays),
            "mcqs": deepcopy(self.cursor_instance.mcqs),
            "outbox_events": list(self.cursor_instance.outbox_events),
            "final_score": self.cursor_instance.final_score,
        }

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1
        if self.snapshot:
            self.cursor_instance.attempt = self.snapshot["attempt"]
            self.cursor_instance.essays = self.snapshot["essays"]
            self.cursor_instance.mcqs = self.snapshot["mcqs"]
            self.cursor_instance.outbox_events = self.snapshot["outbox_events"]
            self.cursor_instance.final_score = self.snapshot["final_score"]

    def close(self):
        pass


class EssayFinalizationTests(unittest.TestCase):
    def _finalize(self, questions, answers, existing=None, status="submitted"):
        cursor = _EssayCursor(questions, existing)
        connection = _EssayConnection(cursor)
        with patch.object(examModel, "get_db_connection", return_value=connection):
            result = examModel.finalizeAttempt(10, 5, answers, status=status)
        return result, cursor, connection

    def test_omitted_null_empty_and_whitespace_essays_are_zero_not_pending(self):
        cases = [
            ("omitted", []),
            ("null", [{"questionId": 11, "answerText": None}]),
            ("empty", [{"questionId": 11, "answerText": ""}]),
            ("whitespace", [{"questionId": 11, "answerText": " \t\n\r "}]),
        ]
        for label, answers in cases:
            with self.subTest(label=label):
                result, cursor, _ = self._finalize([essay_question(11)], answers)
                self.assertEqual(cursor.essays[11], {"answer_text": "", "score": 0})
                self.assertFalse(result["essayPending"])
                self.assertEqual(result["score"], Decimal("0.00"))

    def test_non_empty_essay_remains_pending(self):
        result, cursor, _ = self._finalize(
            [essay_question(11)],
            [{"questionId": 11, "answerText": "A meaningful answer"}],
        )
        self.assertEqual(cursor.essays[11]["score"], None)
        self.assertTrue(result["essayPending"])

    def test_mixed_blank_and_non_empty_has_exactly_one_pending(self):
        result, cursor, _ = self._finalize(
            [essay_question(11), essay_question(12)],
            [
                {"questionId": 11, "answerText": "\t"},
                {"questionId": 12, "answerText": "Substantive"},
            ],
        )
        self.assertEqual(sum(1 for answer in cursor.essays.values() if answer["score"] is None), 1)
        self.assertTrue(result["essayPending"])

    def test_auto_submit_with_legacy_blank_normalizes_to_zero(self):
        existing = {11: {"answer_text": " \n\t", "score": None}}
        result, cursor, _ = self._finalize([essay_question(11)], [], existing=existing)
        self.assertEqual(cursor.essays[11], {"answer_text": "", "score": 0})
        self.assertFalse(result["essayPending"])

    def test_termination_with_blank_essay_is_final(self):
        result, cursor, _ = self._finalize([essay_question(11)], [], status="terminated")
        self.assertEqual(cursor.essays[11]["score"], 0)
        self.assertEqual(result["status"], "terminated")
        self.assertFalse(result["essayPending"])

    def test_repeated_submission_is_idempotent_without_duplicate_essay_rows(self):
        cursor = _EssayCursor([essay_question(11)])
        connection = _EssayConnection(cursor)
        with patch.object(examModel, "get_db_connection", return_value=connection):
            first = examModel.finalizeAttempt(10, 5, [])
            second = examModel.finalizeAttempt(10, 5, [])
        self.assertFalse(first["idempotent"])
        self.assertTrue(second["idempotent"])
        self.assertEqual(len(cursor.essays), 1)
        self.assertFalse(second["essayPending"])
        self.assertEqual(len(cursor.outbox_events), 1)

    def test_same_submit_request_id_creates_one_outbox_event(self):
        cursor = _EssayCursor([essay_question(11)])
        connection = _EssayConnection(cursor)
        request_id = "123e4567-e89b-12d3-a456-426614174000"
        with patch.object(examModel, "get_db_connection", return_value=connection):
            first = examModel.finalizeAttempt(10, 5, [], submit_request_id=request_id)
            second = examModel.finalizeAttempt(10, 5, [], submit_request_id=request_id)

        self.assertFalse(first["idempotent"])
        self.assertTrue(second["idempotent"])
        self.assertEqual(first["submitRequestId"], request_id)
        self.assertEqual(second["submitRequestId"], request_id)
        self.assertEqual(len(cursor.outbox_events), 1)
        self.assertEqual(cursor.attempt["submit_request_id"], request_id)

    def test_outbox_insert_failure_rolls_back_attempt_finalization(self):
        cursor = _EssayCursor([essay_question(11)])
        cursor.fail_outbox = True
        connection = _EssayConnection(cursor)
        with patch.object(examModel, "get_db_connection", return_value=connection):
            with self.assertRaisesRegex(RuntimeError, "outbox insert failed"):
                examModel.finalizeAttempt(
                    10, 5, [], submit_request_id="123e4567-e89b-12d3-a456-426614174000"
                )

        self.assertEqual(cursor.attempt["status"], "in_progress")
        self.assertIsNone(cursor.attempt.get("submit_request_id"))
        self.assertEqual(cursor.outbox_events, [])
        self.assertEqual(connection.rollbacks, 1)

    def test_attempt_update_failure_does_not_insert_an_outbox_event(self):
        cursor = _EssayCursor([essay_question(11)])
        cursor.fail_attempt_update = True
        connection = _EssayConnection(cursor)
        with patch.object(examModel, "get_db_connection", return_value=connection):
            with self.assertRaisesRegex(RuntimeError, "attempt update failed"):
                examModel.finalizeAttempt(
                    10, 5, [], submit_request_id="123e4567-e89b-12d3-a456-426614174000"
                )

        self.assertEqual(cursor.attempt["status"], "in_progress")
        self.assertEqual(cursor.outbox_events, [])
        self.assertEqual(connection.rollbacks, 1)

    def test_finalize_preserves_a_teacher_graded_essay(self):
        existing = {11: {"answer_text": "Teacher-reviewed answer", "score": 4}}
        result, cursor, _ = self._finalize([essay_question(11)], [], existing=existing)
        self.assertEqual(cursor.essays[11], existing[11])
        self.assertEqual(result["score"], Decimal("80.00"))
        self.assertFalse(result["essayPending"])

    def test_objective_questions_award_full_or_zero_raw_score_before_normalization(self):
        questions = [
            objective_question(1, "2"),
            objective_question(2, "3", "true_false"),
            objective_question(3, "5"),
        ]
        result, _, _ = self._finalize(
            questions,
            [
                {"questionId": 1, "selectedOptionId": 11},
                {"questionId": 2, "selectedOptionId": 22},
            ],
        )
        self.assertEqual(result["rawEarnedScore"], Decimal("2"))
        self.assertEqual(result["rawPossibleScore"], Decimal("10"))
        self.assertEqual(result["score"], Decimal("20.00"))

    def test_mixed_objective_max_scores_normalize_after_exact_sum(self):
        questions = [objective_question(1, "1.5"), objective_question(2, "2.5")]
        result, _, _ = self._finalize(
            questions,
            [
                {"questionId": 1, "selectedOptionId": 11},
                {"questionId": 2, "selectedOptionId": 21},
            ],
        )
        self.assertEqual(result["rawEarnedScore"], Decimal("4.0"))
        self.assertEqual(result["rawPossibleScore"], Decimal("4.0"))
        self.assertEqual(result["score"], Decimal("100.00"))


if __name__ == "__main__":
    unittest.main()
