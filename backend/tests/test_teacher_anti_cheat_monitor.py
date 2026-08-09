import unittest
from unittest.mock import patch

from src.route.teacherRoute import antiCheatRoute


class TeacherAntiCheatMonitorTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
