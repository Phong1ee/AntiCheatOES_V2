import unittest
from unittest.mock import patch

from src.controller.teacherController.examController import ExamController
from src.models.teacher import examModel


class _Cursor:
    def __init__(self, row):
        self.row = row
        self.calls = []

    def execute(self, query, params=None):
        self.calls.append((query, params))

    def fetchone(self):
        return self.row

    def close(self):
        pass


class _Connection:
    def __init__(self, row):
        self.cursor_instance = _Cursor(row)
        self.committed = False
        self.rolled_back = False

    def cursor(self, **_kwargs):
        return self.cursor_instance

    def start_transaction(self):
        pass

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        pass


class AttemptSessionTests(unittest.TestCase):
    def test_session_accepts_the_bound_device_and_token(self):
        device_id, token = "browser-a", "active-token"
        connection = _Connection({
            "device_id_hash": examModel._sha256(device_id),
            "session_token_hash": examModel._sha256(token),
            "status": "in_progress", "submitted_at": None, "end_time": None,
        })
        with patch.object(examModel, "get_db_connection", return_value=connection):
            examModel.assertAttemptSession(1, 2, "STU001", device_id, token)

    def test_old_token_and_other_device_are_rejected(self):
        connection = _Connection({
            "device_id_hash": examModel._sha256("browser-a"),
            "session_token_hash": examModel._sha256("new-token"),
            "status": "in_progress", "submitted_at": None, "end_time": None,
        })
        with patch.object(examModel, "get_db_connection", return_value=connection):
            with self.assertRaisesRegex(Exception, "session is invalid"):
                examModel.assertAttemptSession(1, 2, "STU001", "browser-a", "old-token")
            with self.assertRaisesRegex(Exception, "device does not match"):
                examModel.assertAttemptSession(1, 2, "STU001", "browser-b", "new-token")

    def test_legacy_attempt_is_claimed_once_and_session_is_rotated(self):
        connection = _Connection({
            "attempt_id": 2, "exam_id": 1, "student_id": "STU001", "attempt_no": 1,
            "status": "in_progress", "submitted_at": None, "end_time": None,
            "score": None, "violation_count": 3, "device_id_hash": None,
        })
        with patch.object(examModel, "get_db_connection", return_value=connection), patch.object(examModel, "create_attempt_session_token", return_value="rotated-token"):
            attempt, token, claimed = examModel.resumeAttempt(1, 2, "STU001", "browser-a")
        self.assertTrue(claimed)
        self.assertEqual(token, "rotated-token")
        self.assertEqual(attempt["violation_count"], 3)
        queries = "\n".join(query for query, _ in connection.cursor_instance.calls)
        self.assertIn("DEVICE_BOUND_ON_RESUME", queries)
        self.assertTrue(connection.committed)

    def test_different_device_cannot_resume_bound_attempt(self):
        connection = _Connection({
            "attempt_id": 2, "exam_id": 1, "student_id": "STU001", "attempt_no": 1,
            "status": "in_progress", "submitted_at": None, "end_time": None,
            "score": None, "violation_count": 0,
            "device_id_hash": examModel._sha256("browser-a"),
        })
        with patch.object(examModel, "get_db_connection", return_value=connection):
            with self.assertRaisesRegex(Exception, "device does not match"):
                examModel.resumeAttempt(1, 2, "STU001", "browser-b")

    def test_heartbeat_requires_session_and_only_updates_heartbeat(self):
        connection = _Connection({"last_heartbeat_at": "now", "violation_count": 4, "status": "in_progress"})
        with patch.object(examModel, "assertAttemptSession") as validate, patch.object(examModel, "get_db_connection", return_value=connection):
            state = examModel.heartbeatAttempt(1, 2, "STU001", "browser-a", "token")
        validate.assert_called_once_with(1, 2, "STU001", "browser-a", "token")
        self.assertEqual(state["violation_count"], 4)
        self.assertIn("last_heartbeat_at", connection.cursor_instance.calls[0][0])

    def test_page_refresh_uses_event_engine_response_without_resetting_count(self):
        attempt = {"attempt_id": 2, "status": "in_progress", "violation_count": 4}
        event_state = {"violationCount": 5, "terminated": False, "attemptStatus": "in_progress"}
        with patch.object(examModel, "getAssignedExamById", return_value={"start_time": None, "end_time": None}), patch.object(examModel, "get_database_now"), patch.object(examModel, "resumeAttempt", return_value=(attempt, "new-token", False)), patch.object(examModel, "getExamSettings", return_value={"anti_cheat_enabled": True, "violation_limit": 8}), patch.object(examModel, "recordAntiCheatEvent", return_value=event_state) as record:
            result = ExamController.resumeAttempt("STU001", "student", 1, 2, "browser-a", "page_refresh", "reload-1")
        self.assertEqual(result["violationCount"], 5)
        self.assertEqual(result["sessionToken"], "new-token")
        self.assertEqual(record.call_args.args[2]["clientEventId"], "reload-1")

    def test_start_does_not_create_a_second_open_attempt_for_api_calls(self):
        with patch.object(ExamController, "_validateStudentExamAccess", return_value={
            "user": {"school_id": "STU001"}, "exam": {"exam_id": 1}, "attempts_used": 1,
            "database_now": None, "open_attempt": {"attempt_id": 2},
        }):
            with self.assertRaisesRegex(Exception, "must be resumed"):
                ExamController.startExam("STU001", "student", 1, None, "browser-a")
