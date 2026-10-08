import unittest
from unittest.mock import patch

from src.models.teacher import examModel


class FakeCursor:
    def __init__(self, rows):
        self.rows = list(rows)
        self.executed = []
        self.rowcount = 0

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def close(self):
        pass


class FakeConnection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.committed = False
        self.rolled_back = False

    def cursor(self, dictionary=False):
        return self._cursor

    def start_transaction(self):
        pass

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        pass


def _bound_attempt(**overrides):
    attempt = {
        "attempt_id": 1, "exam_id": 1, "student_id": "S1", "attempt_no": 1, "status": "in_progress",
        "start_time": None, "submitted_at": None, "end_time": None, "score": None, "violation_count": 0,
        "device_id_hash": "hash", "anti_cheat_policy_snapshot": None, "is_locked": 0, "lock_reason": None,
        "paused_at": None, "paused_total_seconds": 0, "awaiting_student_resume": 0, "last_heartbeat_at": None,
        "termination_reason": None,
    }
    attempt.update(overrides)
    return attempt


class HeartbeatLockStateTests(unittest.TestCase):
    def _heartbeat(self, cursor_rows, attempt):
        cursor = FakeCursor(cursor_rows)
        cnx = FakeConnection(cursor)
        with patch.object(examModel, "get_db_connection", return_value=cnx), \
             patch.object(examModel, "_get_attempt_for_bound_session", return_value=attempt):
            result = examModel.heartbeatAttempt(1, 1, "S1", "device", "token")
        return result, cnx, cursor

    def test_unchanged_timestamp_in_same_second_is_not_reported_as_lock(self):
        # rowcount 0 means MySQL saw no changed rows; this must not look like a teacher lock.
        final_row = {"last_heartbeat_at": None, "violation_count": 0, "status": "in_progress", "is_locked": 0}
        result, cnx, cursor = self._heartbeat([{"is_locked": 0}, final_row], _bound_attempt())
        self.assertTrue(cnx.committed)
        self.assertFalse(cnx.rolled_back)
        self.assertEqual(result["is_locked"], 0)

    def test_heartbeat_locks_row_before_updating_timestamp(self):
        final_row = {"last_heartbeat_at": None, "violation_count": 0, "status": "in_progress", "is_locked": 0}
        _, _, cursor = self._heartbeat([{"is_locked": 0}, final_row], _bound_attempt())
        self.assertIn("FOR UPDATE", cursor.executed[0][0])
        self.assertIn("UPDATE attempt SET last_heartbeat_at", cursor.executed[1][0])

    def test_real_teacher_lock_is_still_enforced(self):
        cursor_rows = [{"is_locked": 1}]
        with self.assertRaisesRegex(Exception, "Attempt is locked by teacher"):
            self._heartbeat(cursor_rows, _bound_attempt())

    def test_locked_attempt_returns_lock_status_without_update(self):
        result, cnx, cursor = self._heartbeat([], _bound_attempt(is_locked=1, lock_reason="check"))
        self.assertTrue(result["is_locked"])
        self.assertEqual(cursor.executed, [])

    def test_awaiting_unlock_returns_confirmation_state_without_update(self):
        result, _, cursor = self._heartbeat([], _bound_attempt(awaiting_student_resume=1))
        self.assertTrue(result["awaiting_student_resume"])
        self.assertFalse(result["is_locked"])
        self.assertEqual(cursor.executed, [])


class ResumeLockStateTests(unittest.TestCase):
    def _resume(self, attempt, resume_teacher_pause):
        cursor = FakeCursor([attempt])
        cnx = FakeConnection(cursor)
        with patch.object(examModel, "get_db_connection", return_value=cnx):
            examModel.resumeAttempt(1, 1, "S1", "device", resume_teacher_pause=resume_teacher_pause)
        return cnx

    def test_teacher_unlock_resume_requires_pending_confirmation(self):
        with self.assertRaisesRegex(Exception, "not awaiting teacher-unlock confirmation"):
            self._resume(_bound_attempt(awaiting_student_resume=0), resume_teacher_pause=True)

    def test_ordinary_resume_is_blocked_while_confirmation_is_pending(self):
        with self.assertRaisesRegex(Exception, "student confirmation is required"):
            self._resume(_bound_attempt(awaiting_student_resume=1), resume_teacher_pause=False)

    def test_ordinary_resume_is_blocked_by_a_real_lock(self):
        with self.assertRaisesRegex(Exception, "Attempt is locked by teacher"):
            self._resume(_bound_attempt(is_locked=1), resume_teacher_pause=False)


if __name__ == "__main__":
    unittest.main()
