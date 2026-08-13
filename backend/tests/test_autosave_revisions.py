from datetime import datetime, timedelta
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from src.models.teacher import examModel
from src.route.studentRoute.examRoute import AutoSaveAnswerRequest


class _AutosaveCursor:
    def __init__(self, question_type: str, stored_answer: object = None, stored_revision: int = 0):
        self.question_type = question_type
        self.answer = stored_answer
        self.revision = stored_revision
        self.last_query = ""
        self.last_saved_at = datetime(2026, 8, 11, 10, 0, 0)
        self.write_count = 0

    def execute(self, query, params=()):
        self.last_query = " ".join(query.split())
        if "INSERT INTO mcq_answers" in self.last_query:
            self.answer = params[2]
            self.revision = params[3]
            self.write_count += 1
        elif "INSERT INTO essay_answers" in self.last_query:
            self.answer = params[2]
            self.revision = params[4]
            self.write_count += 1
        elif "UPDATE attempt SET last_saved_at" in self.last_query:
            self.last_saved_at += timedelta(seconds=1)

    def fetchone(self):
        if "FROM attempt a JOIN exam e" in self.last_query:
            return {
                "status": "in_progress",
                "submitted_at": None,
                "end_time": None,
                "start_time": datetime(2026, 8, 11, 9, 30, 0),
                "last_saved_at": self.last_saved_at,
                "duration_minutes": 60,
                "exam_end_time": None,
            }
        if "SELECT NOW() AS database_now" in self.last_query:
            return {"database_now": datetime(2026, 8, 11, 10, 0, 0)}
        if "SELECT sequential_navigation" in self.last_query:
            return {"sequential_navigation": False}
        if "SELECT revision FROM mcq_answers" in self.last_query or "SELECT revision FROM essay_answers" in self.last_query:
            return {"revision": self.revision} if self.revision else None
        if "SELECT last_saved_at FROM attempt" in self.last_query:
            return {"last_saved_at": self.last_saved_at}
        return None

    def fetchall(self):
        if "FROM attempt_question" not in self.last_query:
            return []
        return [{
            "question_id": 30,
            "display_order": 1,
            "question_point": 1,
            "question_type_snapshot": self.question_type,
            "question_point_snapshot": 1,
            "options_snapshot": [{"id": 101}, {"id": 102}],
            "question_type": self.question_type,
        }]

    def close(self):
        pass


class _AutosaveConnection:
    def __init__(self, cursor):
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


class _RestoreCursor:
    def __init__(self, row):
        self.row = row

    def execute(self, *_args, **_kwargs):
        pass

    def fetchall(self):
        return [self.row]

    def close(self):
        pass


class _RestoreConnection:
    def __init__(self, row):
        self.cursor_instance = _RestoreCursor(row)

    def cursor(self, **_kwargs):
        return self.cursor_instance

    def close(self):
        pass


class AutosaveRevisionTests(unittest.TestCase):
    def test_mcq_late_revision_does_not_overwrite_newer_answer(self):
        cursor = _AutosaveCursor("MCQ")
        connection = _AutosaveConnection(cursor)

        with patch.object(examModel, "get_db_connection", return_value=connection):
            saved = examModel.saveAttemptAnswer(10, 5, 30, {"selectedOptionId": 102, "revision": 8})
            stale = examModel.saveAttemptAnswer(10, 5, 30, {"selectedOptionId": 101, "revision": 7})

        self.assertEqual(saved["storedRevision"], 8)
        self.assertFalse(saved["stale"])
        self.assertTrue(stale["stale"])
        self.assertEqual(stale["storedRevision"], 8)
        self.assertEqual(cursor.answer, 102)
        self.assertEqual(cursor.revision, 8)
        self.assertEqual(cursor.write_count, 1)
        self.assertEqual(connection.rollbacks, 0)

    def test_essay_late_revision_does_not_overwrite_newer_answer(self):
        cursor = _AutosaveCursor("essay")
        connection = _AutosaveConnection(cursor)

        with patch.object(examModel, "get_db_connection", return_value=connection):
            saved = examModel.saveAttemptAnswer(10, 5, 30, {"answerText": "NEW", "revision": 8})
            stale = examModel.saveAttemptAnswer(10, 5, 30, {"answerText": "OLD", "revision": 7})

        self.assertEqual(saved["storedRevision"], 8)
        self.assertFalse(saved["stale"])
        self.assertTrue(stale["stale"])
        self.assertEqual(stale["storedRevision"], 8)
        self.assertEqual(cursor.answer, "NEW")
        self.assertEqual(cursor.revision, 8)
        self.assertEqual(cursor.write_count, 1)

    def test_restore_revision_is_returned_and_the_next_save_advances_it(self):
        restored_row = {
            "question_id": 30,
            "question_text": "Snapshot question",
            "question_type": "MCQ",
            "question_point": 1,
            "question_text_snapshot": "Snapshot question",
            "question_type_snapshot": "MCQ",
            "question_point_snapshot": 1,
            "options_snapshot": [{"id": 101, "text": "A"}, {"id": 102, "text": "B"}],
            "selected_option_id": 101,
            "mcq_revision": 8,
            "answer_text": None,
            "essay_revision": None,
        }
        with patch.object(examModel, "get_db_connection", return_value=_RestoreConnection(restored_row)):
            restored = examModel.getExamQuestions(5, 10)

        self.assertEqual(restored[0]["savedAnswer"], {"selectedOptionId": 101, "revision": 8})
        cursor = _AutosaveCursor("MCQ", stored_answer=101, stored_revision=8)
        with patch.object(examModel, "get_db_connection", return_value=_AutosaveConnection(cursor)):
            continued = examModel.saveAttemptAnswer(10, 5, 30, {"selectedOptionId": 102, "revision": 9})

        self.assertFalse(continued["stale"])
        self.assertEqual(cursor.answer, 102)
        self.assertEqual(cursor.revision, 9)

    def test_autosave_request_requires_a_positive_revision(self):
        self.assertEqual(AutoSaveAnswerRequest(selectedOptionId=101, revision=1).revision, 1)
        with self.assertRaises(ValidationError):
            AutoSaveAnswerRequest(selectedOptionId=101)
        with self.assertRaises(ValidationError):
            AutoSaveAnswerRequest(selectedOptionId=101, revision=0)
