from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from itertools import count
import threading
import unittest
from unittest.mock import patch

from src.controller.teacherController.examController import ExamController
from src.models.teacher import examModel


class _MaxAttemptCursor:
    def __init__(self):
        self.last_query = ""
        self.queries: list[str] = []

    def execute(self, query, _params=None):
        self.last_query = " ".join(query.split())
        self.queries.append(self.last_query)

    def fetchone(self):
        if "FROM student_exam" in self.last_query:
            return ("S1",)
        if "SELECT exam_id, examcode, max_attempt" in self.last_query:
            return (5, "CODE", 1, None, None, "manual")
        if "SELECT NOW()" in self.last_query:
            return (datetime(2026, 8, 10, 10, 0),)
        if "COUNT(attempt_id)" in self.last_query:
            return (1,)
        if "FROM attempt" in self.last_query:
            return None
        return None

    def close(self):
        pass


class _MaxAttemptConnection:
    def __init__(self):
        self.cursor_instance = _MaxAttemptCursor()
        self.started = False
        self.rolled_back = False

    def cursor(self, **_kwargs):
        return self.cursor_instance

    def start_transaction(self):
        self.started = True

    def commit(self):
        pass

    def rollback(self):
        self.rolled_back = True

    def close(self):
        pass


class AtomicStartAttemptTests(unittest.TestCase):
    def test_attempt_creation_locks_assignment_and_rechecks_max_attempt(self):
        connection = _MaxAttemptConnection()

        with patch.object(examModel, "get_db_connection", return_value=connection):
            with self.assertRaisesRegex(Exception, "Maximum attempts exceeded"):
                examModel.createAttempt(5, "S1", 99, "browser-a", "token-a", "CODE")

        queries = "\n".join(connection.cursor_instance.queries)
        self.assertTrue(connection.started)
        self.assertTrue(connection.rolled_back)
        self.assertIn("FROM student_exam", queries)
        self.assertIn("FROM exam", queries)
        self.assertIn("COUNT(attempt_id)", queries)
        self.assertIn("FOR UPDATE", queries)
        self.assertNotIn("INSERT INTO attempt", queries)

    def test_two_concurrent_starts_create_one_attempt_and_conflict_the_other(self):
        self._assert_concurrent_start_behavior(2)

    def test_ten_concurrent_starts_create_one_attempt_and_conflict_the_rest(self):
        self._assert_concurrent_start_behavior(10)

    def _assert_concurrent_start_behavior(self, request_count: int):
        start_barrier = threading.Barrier(request_count)
        attempt_lock = threading.Lock()
        token_numbers = count(1)
        attempt_state = {"session_token_hash": None}
        exam = {
            "exam_id": 5,
            "duration_minutes": 60,
            "end_time": None,
        }
        validated = {
            "user": {"school_id": "S1"},
            "exam": exam,
            "attempts_used": 0,
            "open_attempt": None,
            "database_now": datetime(2026, 8, 10, 10, 0),
        }

        def next_token():
            return f"session-{next(token_numbers)}"

        def atomic_create(_exam_id, _student_id, _attempt_no, _device_id, token, _code):
            start_barrier.wait(timeout=3)
            with attempt_lock:
                if attempt_state["session_token_hash"] is None:
                    attempt_state["session_token_hash"] = examModel._sha256(token)
                return 10

        def get_attempt(_attempt_id):
            return {
                "attempt_id": 10,
                "attempt_no": 1,
                "status": "in_progress",
                "start_time": datetime(2026, 8, 10, 10, 0),
                "violation_count": 0,
                **attempt_state,
            }

        def start_once():
            try:
                return ("started", ExamController.startExam("S1", "student", 5, None, "browser-a"))
            except Exception as exc:
                return ("conflict", str(exc))

        with (
            patch.object(ExamController, "_validateStudentExamAccess", return_value=validated),
            patch.object(examModel, "create_attempt_session_token", side_effect=next_token),
            patch.object(examModel, "createAttempt", side_effect=atomic_create),
            patch.object(examModel, "getAttemptById", side_effect=get_attempt),
            patch.object(examModel, "getExamSettings", return_value={"anti_cheat_enabled": False, "violation_limit": 5}),
            patch.object(examModel, "get_database_now", return_value=validated["database_now"]),
        ):
            with ThreadPoolExecutor(max_workers=request_count) as executor:
                outcomes = list(executor.map(lambda _index: start_once(), range(request_count)))

        started = [result for status, result in outcomes if status == "started"]
        conflicts = [result for status, result in outcomes if status == "conflict"]
        self.assertEqual(len(started), 1)
        self.assertEqual(started[0]["attemptId"], 10)
        self.assertEqual(len(conflicts), request_count - 1)
        self.assertTrue(all(message == "Open attempt must be resumed" for message in conflicts))
