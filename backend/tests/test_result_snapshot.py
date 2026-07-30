import unittest

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


class ResultSnapshotTests(unittest.TestCase):
    def test_result_detail_uses_snapshot_after_live_question_changes(self):
        questions = resultModel._get_attempt_questions(_SnapshotCursor(), 10)

        self.assertEqual(questions[0]["question"], "Snapshot text")
        self.assertEqual(questions[0]["options"], ["Snapshot A", "Snapshot B"])
        self.assertEqual(questions[0]["studentAnswer"], "Snapshot A")
        self.assertEqual(questions[0]["correctAnswer"], "Snapshot A")
        self.assertEqual((questions[0]["points"], questions[0]["score"]), (3, 3))

    def test_hidden_and_score_only_visibility_do_not_allow_details(self):
        self.assertEqual(resultModel._result_flags("hidden", 0), ("hidden", False, False))
        self.assertEqual(resultModel._result_flags("score-only", 0), ("published", True, False))


if __name__ == "__main__":
    unittest.main()
