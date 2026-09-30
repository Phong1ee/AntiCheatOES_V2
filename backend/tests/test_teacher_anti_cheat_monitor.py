import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from src.route.teacherRoute import antiCheatRoute


class TeacherAntiCheatMonitorTests(unittest.TestCase):
    def _active_attempt(self, *, is_locked=False):
        return SimpleNamespace(
            attempt_id=10, exam_id=5, student_id="S1",
            status=antiCheatRoute.AttemptStatus.in_progress,
            submitted_at=None, end_time=None, score=None, is_locked=is_locked,
            locked_at=None, locked_by=None, lock_reason=None,
            termination_reason=None, score_scale_version=None,
        )

    def test_attempt_summary_is_authorized_and_contains_live_monitor_fields(self):
        queries = []

        def fake_rows(query, params=()):
            queries.append((query, params))
            if "SELECT exam_id, subject_id FROM exam" in query:
                return [{"exam_id": 5, "subject_id": "IT4409"}]
            return [{
                "attemptId": 10,
                "studentId": "S1",
                "studentName": "Student One",
                "attemptStatus": "in_progress",
                "violationCount": 2,
                "violationLimit": 5,
                "lastViolationAt": "2026-08-09T10:31:04",
                "latestEventType": "GAZE_AWAY_SUSTAINED",
                "latestEventAt": "2026-08-09T10:31:04",
                "cameraFlagCount": 1,
                "audioFlagCount": 0,
                "browserViolationCount": 1,
                "aiFlagCount": 1,
                "flagged": 1,
            }]

        with patch.object(antiCheatRoute, "rows", side_effect=fake_rows):
            result = antiCheatRoute.attempts(5, user={"school_id": "T1"})

        self.assertEqual(result[0]["latestEventType"], "GAZE_AWAY_SUSTAINED")
        self.assertEqual(result[0]["browserViolationCount"], 1)
        summary_query = queries[-1][0]
        self.assertIn("event_summary", summary_query)
        self.assertIn("lastViolationAt", summary_query)
        self.assertIn("cameraFlagCount", summary_query)

    def test_attempt_summary_rejects_exam_not_owned_by_teacher(self):
        with patch.object(antiCheatRoute, "rows", return_value=[]):
            with self.assertRaises(antiCheatRoute.HTTPException) as raised:
                antiCheatRoute.attempts(5, user={"school_id": "T1"})

        self.assertEqual(raised.exception.status_code, 404)

    def test_teacher_can_lock_then_unlock_active_attempt_with_events_and_audit(self):
        attempt = self._active_attempt()
        db = MagicMock()
        user = {"school_id": "T1", "role": "teacher"}

        with patch.object(antiCheatRoute, "_owned_active_attempt_for_update", return_value=attempt), \
             patch.object(antiCheatRoute, "record_audit") as record_audit:
            locked = antiCheatRoute.lock_attempt(
                10, antiCheatRoute.LockAttemptRequest(reason="Review required"), user, db
            )
            self.assertTrue(locked["isLocked"])
            self.assertTrue(attempt.is_locked)
            self.assertEqual(db.add.call_args.args[0].event_type, "ATTEMPT_LOCKED")
            self.assertEqual(record_audit.call_args.kwargs["action"], "ATTEMPT_LOCKED")

            db.reset_mock()
            record_audit.reset_mock()
            unlocked = antiCheatRoute.unlock_attempt(10, user, db)

        self.assertFalse(unlocked["isLocked"])
        self.assertFalse(attempt.is_locked)
        self.assertEqual(db.add.call_args.args[0].event_type, "ATTEMPT_UNLOCKED")
        self.assertEqual(record_audit.call_args.kwargs["action"], "ATTEMPT_UNLOCKED")

    def test_teacher_termination_sets_zero_score_finalizes_essay_and_audits(self):
        attempt = self._active_attempt(is_locked=True)
        db = MagicMock()
        db.get.return_value = SimpleNamespace(exam_id=5)
        user = {"school_id": "T1", "role": "teacher"}

        with patch.object(antiCheatRoute, "_owned_active_attempt_for_update", return_value=attempt), \
             patch.object(antiCheatRoute, "sync_student_final_score") as sync_score, \
             patch.object(antiCheatRoute, "record_audit") as record_audit:
            result = antiCheatRoute.terminate_attempt(
                10, antiCheatRoute.TerminateAttemptRequest(reason="Teacher intervention"), user, db
            )

        self.assertEqual(result["attemptStatus"], "terminated")
        self.assertEqual(attempt.status, antiCheatRoute.AttemptStatus.terminated)
        self.assertEqual(attempt.score, 0)
        self.assertFalse(attempt.is_locked)
        db.query.return_value.filter.return_value.update.assert_called_once()
        self.assertEqual(db.add.call_args.args[0].event_type, "ATTEMPT_TERMINATED")
        sync_score.assert_called_once_with(db, db.get.return_value, "S1")
        self.assertEqual(record_audit.call_args.kwargs["action"], "ATTEMPT_TERMINATED_BY_TEACHER")


if __name__ == "__main__":
    unittest.main()
