import unittest
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


class _EssayCursor:
    def __init__(self, questions: list[dict], existing: dict[int, dict] | None = None):
        self.questions = questions
        self.essays = existing or {}
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

    def execute(self, query, params=()):
        normalized = " ".join(query.split())
        self.fetchone_value = None
        self.fetchall_value = []
        if normalized.startswith("SELECT status, submitted_at"):
            self.fetchone_value = dict(self.attempt)
        elif "FROM attempt_question aq" in normalized:
            self.fetchall_value = list(self.questions)
        elif normalized.startswith("SELECT answer_text FROM essay_answers"):
            self.fetchone_value = self.essays.get(int(params[1]))
        elif normalized.startswith("INSERT INTO essay_answers"):
            _, question_id, answer_text, score = params
            self.essays[int(question_id)] = {"answer_text": answer_text, "score": score}
        elif normalized.startswith("SELECT question_id, selected_option_id"):
            self.fetchall_value = []
        elif normalized.startswith("SELECT COUNT(*) AS pending"):
            self.fetchone_value = {
                "pending": sum(1 for answer in self.essays.values() if answer["score"] is None)
            }
        elif normalized.startswith("UPDATE attempt SET score"):
            score, status, _reason, _attempt_id = params
            self.attempt.update(
                score=score,
                status=status,
                submitted_at=datetime(2026, 8, 3, 10, 0),
                end_time=datetime(2026, 8, 3, 10, 0),
            )
        elif normalized.startswith("SELECT result_strategy"):
            self.fetchone_value = {"result_strategy": "highest"}
        elif normalized.startswith("SELECT score FROM attempt"):
            self.fetchall_value = [{"score": self.attempt["score"]}]
        elif normalized.startswith("UPDATE student_exam SET final_score"):
            self.final_score = params[0]
        elif normalized.startswith("INSERT INTO exam_event"):
            return
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

    def cursor(self, **_kwargs):
        return self.cursor_instance

    def start_transaction(self):
        pass

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

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


if __name__ == "__main__":
    unittest.main()
