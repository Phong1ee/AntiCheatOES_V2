import unittest
from decimal import Decimal
from unittest.mock import patch

from src.models import resultModel


class _SnapshotCursor:
    def __init__(self):
        self.last_query = ""

    def execute(self, query, _params):
        self.last_query = query

    def fetchall(self):
        if "FROM attempt_question" in self.last_query:
            return [{
                "question_id": 11,
                "display_order": 1,
                "question_text": "Live text changed later",
                "question_type": "MCQ",
                "subject_id": "DB",
                "question_point": 1,
                "question_text_snapshot": "Snapshot text",
                "question_type_snapshot": "MCQ",
                "question_point_snapshot": 3,
                "options_snapshot": '[{"id": 101, "text": "Snapshot A", "isCorrect": true}, {"id": 102, "text": "Snapshot B", "isCorrect": false}]',
                "selected_option_id": 101,
                "essay_answer": None,
                "essay_score": None,
            }]
        return []


class _ResultCursor:
    def __init__(self, row: dict):
        self.row = row
        self.last_query = ""
        self.last_params = ()

    def execute(self, query, params):
        self.last_query = query
        self.last_params = params

    def fetchall(self):
        return [self.row]

    def fetchone(self):
        return self.row

    def close(self):
        pass


class _ResultConnection:
    def __init__(self, cursor: _ResultCursor):
        self.cursor_instance = cursor

    def cursor(self, **_kwargs):
        return self.cursor_instance

    def close(self):
        pass


class ResultSnapshotTests(unittest.TestCase):
    @staticmethod
    def _result_row(visibility: str | None, pending_essays: int = 0) -> dict:
        return {
            "attempt_id": 10,
            "exam_id": 5,
            "attempt_no": 1,
            "score": Decimal("8.00"),
            "start_time": None,
            "end_time": None,
            "submitted_at": None,
            "attempt_status": "submitted",
            "title": "Exam",
            "description": "Description",
            "duration_minutes": 60,
            "max_attempt": 1,
            "result_visibility": visibility,
            "exam_total_points": Decimal("10.00"),
            "passing_score": Decimal("5.00"),
            "subject": "Database",
            "total_questions": 2,
            "snapshot_total_points": Decimal("10.00"),
            "pending_essay_count": pending_essays,
            "correct_answers": 2,
        }

    def test_result_detail_uses_snapshot_after_live_question_changes(self):
        questions = resultModel._get_attempt_questions(_SnapshotCursor(), 10)

        self.assertEqual(questions[0]["question"], "Snapshot text")
        self.assertEqual(questions[0]["options"], ["Snapshot A", "Snapshot B"])
        self.assertEqual(questions[0]["studentAnswer"], "Snapshot A")
        self.assertEqual(questions[0]["correctAnswer"], "Snapshot A")
        self.assertEqual(questions[0]["correctAnswers"], ["Snapshot A"])
        self.assertEqual((questions[0]["points"], questions[0]["score"]), (3, 3))
        self.assertEqual((questions[0]["maxPoints"], questions[0]["awardedPoints"]), (3, 3))
        self.assertEqual(questions[0]["gradingStatus"], "graded")

    def test_attempt_total_points_prefers_attempt_allocation(self):
        self.assertEqual(resultModel._attempt_total_points(Decimal("50.00"), 100), 50)
        self.assertEqual(resultModel._attempt_total_points(Decimal("0.00"), 100), 0)

    def test_hidden_and_score_only_visibility_do_not_allow_details(self):
        self.assertEqual(resultModel._result_flags("hidden", 0), ("hidden", False, False))
        self.assertEqual(resultModel._result_flags("score-only", 0), ("published", True, False))

    def test_visibility_status_matrix_and_legacy_fallback_are_safe(self):
        cases = {
            ("hidden", 0): ("hidden", False, False),
            ("hidden", 1): ("hidden", False, False),
            ("score-only", 0): ("published", True, False),
            ("score-only", 1): ("pending", False, False),
            ("full", 0): ("published", True, True),
            ("full", 1): ("pending", False, False),
            (None, 0): ("hidden", False, False),
        }
        for (visibility, pending_essays), expected in cases.items():
            with self.subTest(visibility=visibility, pending_essays=pending_essays):
                self.assertEqual(resultModel._result_flags(visibility, pending_essays), expected)

    def test_list_and_detail_do_not_leak_hidden_or_score_only_content(self):
        for visibility, pending_essays, expected_status, score_visible in (
            ("hidden", 0, "hidden", False),
            ("score-only", 1, "pending", False),
            ("score-only", 0, "published", True),
        ):
            with self.subTest(visibility=visibility, pending_essays=pending_essays):
                list_cursor = _ResultCursor(self._result_row(visibility, pending_essays))
                with patch.object(resultModel, "get_db_connection", return_value=_ResultConnection(list_cursor)):
                    listed = resultModel.get_student_results("S1")[0]
                self.assertEqual(listed["status"], expected_status)
                self.assertEqual(listed["scoreVisible"], score_visible)
                self.assertEqual(listed["score"], 8 if score_visible else None)
                self.assertIsNone(listed["rawScore"])
                self.assertIsNone(listed["correctAnswers"])
                self.assertIn("a.status IN ('submitted', 'terminated')", list_cursor.last_query)
                self.assertEqual(list_cursor.last_params, ("S1",))

                detail_cursor = _ResultCursor(self._result_row(visibility, pending_essays))
                with patch.object(resultModel, "get_db_connection", return_value=_ResultConnection(detail_cursor)):
                    detail = resultModel.get_student_result_detail("S1", 10)
                self.assertEqual(detail["status"], expected_status)
                self.assertEqual(detail["score"], 8 if score_visible else None)
                self.assertIsNone(detail["rawScore"])
                self.assertEqual(detail["questions"], [])
                self.assertIsNone(detail["correctAnswers"])
                self.assertIn("a.status IN ('submitted', 'terminated')", detail_cursor.last_query)
                self.assertEqual(detail_cursor.last_params, ("S1", 10))

    def test_full_visibility_uses_current_exam_value_to_publish_detail(self):
        row = self._result_row("hidden")
        cursor = _ResultCursor(row)
        connection = _ResultConnection(cursor)
        with patch.object(resultModel, "get_db_connection", return_value=connection):
            self.assertEqual(resultModel.get_student_results("S1")[0]["status"], "hidden")
            row["result_visibility"] = "full"
            published = resultModel.get_student_results("S1")[0]
        self.assertEqual((published["status"], published["score"], published["correctAnswers"]), ("published", 8, 2))

        detail_cursor = _ResultCursor(row)
        with (
            patch.object(resultModel, "get_db_connection", return_value=_ResultConnection(detail_cursor)),
            patch.object(
                resultModel,
                "_get_attempt_questions",
                return_value=[{"isCorrect": True, "awardedPoints": 4}],
            ),
        ):
            detail = resultModel.get_student_result_detail("S1", 10)
        self.assertTrue(detail["allowViewDetails"])
        self.assertEqual((detail["score"], detail["correctAnswers"], len(detail["questions"])), (8, 1, 1))


if __name__ == "__main__":
    unittest.main()
