import inspect
import unittest
from decimal import Decimal
from unittest.mock import patch

from pydantic import ValidationError

from src.models.teacher import examModel
from src.route.studentRoute.examRoute import AntiCheatEventRequest


class _EventCursor:
    def __init__(self, *, enabled=True, limit=5):
        self.attempt = {
            "attempt_id": 10, "exam_id": 5, "student_id": "S1", "status": "in_progress",
            "submitted_at": None, "end_time": None, "score": None, "violation_count": 0,
        }
        self.setting = {"anti_cheat_enabled": enabled, "violation_limit": limit}
        self.events = set()
        self.termination_events = 0
        self.fetchone_value = None
        self.fetchall_value = []

    def execute(self, query, params=()):
        sql = " ".join(query.split())
        self.fetchone_value, self.fetchall_value = None, []
        if "FROM attempt WHERE attempt_id" in sql:
            self.fetchone_value = dict(self.attempt)
        elif sql.startswith("SELECT anti_cheat_enabled"):
            self.fetchone_value = dict(self.setting)
        elif sql.startswith("SELECT event_id FROM exam_event"):
            self.fetchone_value = {"event_id": 1} if params[1] in self.events else None
        elif sql.startswith("INSERT INTO exam_event"):
            if len(params) == 7:
                self.events.add(params[5])
            else:
                self.termination_events += 1
        elif sql.startswith("UPDATE attempt SET violation_count"):
            self.attempt["violation_count"] += 1
        elif "FROM attempt_question aq" in sql:
            self.fetchall_value = []
        elif sql.startswith("UPDATE essay_answers SET score = 0"):
            pass
        elif sql.startswith("UPDATE attempt SET score = 0.00"):
            self.attempt.update(status="terminated", score=Decimal("0.00"), submitted_at=True, end_time=True)
        elif sql.startswith("SELECT result_strategy"):
            self.fetchone_value = {"result_strategy": "highest"}
        elif sql.startswith("SELECT score FROM attempt"):
            self.fetchall_value = [{"score": self.attempt["score"]}]
        elif sql.startswith("UPDATE student_exam SET final_score"):
            pass
        else:
            raise AssertionError(f"Unexpected SQL: {sql}")

    def fetchone(self):
        return self.fetchone_value

    def fetchall(self):
        return self.fetchall_value

    def close(self):
        pass


class _EventConnection:
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


def event(event_type, client_event_id):
    return {
        "attemptId": 10,
        "clientEventId": client_event_id,
        "eventType": event_type,
        "source": "browser",
        "details": None,
        "metadata": None,
        "answers": [],
    }


class AntiCheatEventTests(unittest.TestCase):
    def _record(self, cursor, payload):
        with patch.object(examModel, "get_db_connection", return_value=_EventConnection(cursor)):
            return examModel.recordAntiCheatEvent(5, "S1", payload)

    def test_disabled_exam_records_diagnostic_without_incrementing_counter(self):
        cursor = _EventCursor(enabled=False)
        result = self._record(cursor, event("TAB_HIDDEN", "disabled-1"))
        self.assertTrue(result["eventAccepted"])
        self.assertFalse(result["antiCheatEnabled"])
        self.assertEqual(result["violationCount"], 0)
        self.assertFalse(result["terminated"])

    def test_shared_counter_and_duplicate_idempotency(self):
        cursor = _EventCursor(limit=5)
        first = self._record(cursor, event("TAB_HIDDEN", "event-1"))
        second = self._record(cursor, event("COPY_ATTEMPT", "event-2"))
        duplicate = self._record(cursor, event("COPY_ATTEMPT", "event-2"))
        self.assertEqual((first["violationCount"], second["violationCount"]), (1, 2))
        self.assertTrue(duplicate["duplicate"])
        self.assertEqual(duplicate["violationCount"], 2)

    def test_limit_terminates_once_with_zero_score(self):
        cursor = _EventCursor(limit=1)
        terminated = self._record(cursor, event("FULLSCREEN_EXIT", "event-1"))
        later = self._record(cursor, event("TAB_HIDDEN", "event-2"))
        self.assertTrue(terminated["terminated"])
        self.assertEqual(terminated["score"], Decimal("0.00"))
        self.assertEqual(cursor.termination_events, 1)
        self.assertFalse(later["eventAccepted"])
        self.assertEqual(cursor.termination_events, 1)

    def test_event_engine_locks_the_attempt_before_counting(self):
        source = inspect.getsource(examModel.recordAntiCheatEvent)
        self.assertIn("FOR UPDATE", source)
        self.assertIn("start_transaction", source)

    def test_client_cannot_submit_system_event_or_invalid_payload(self):
        with self.assertRaises(ValidationError):
            AntiCheatEventRequest(
                attemptId=10, clientEventId="system", eventType="ATTEMPT_TERMINATED", source="browser",
            )
        for value in ("", "x" * 65):
            with self.assertRaises(ValidationError):
                AntiCheatEventRequest(attemptId=10, clientEventId=value, eventType="TAB_HIDDEN", source="browser")


if __name__ == "__main__":
    unittest.main()
