import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from src.controller.teacherController.examController import ExamController
from src.models.teacher import examModel


class _Cursor:
    def __init__(self, rows):
        self.rows = rows

    def execute(self, *_args, **_kwargs):
        pass

    def fetchall(self):
        return self.rows

    def close(self):
        pass


class _Connection:
    def __init__(self, rows):
        self.cursor_instance = _Cursor(rows)

    def cursor(self, **_kwargs):
        return self.cursor_instance

    def close(self):
        pass


class _CreateCursor:
    def __init__(self):
        self.lastrowid = 10
        self.last_query = ""
        self.inserted_rows = []

    def execute(self, query, *_args, **_kwargs):
        self.last_query = query

    def executemany(self, _query, rows):
        self.inserted_rows = list(rows)

    def fetchone(self):
        if "FROM attempt" in self.last_query:
            return None
        if "question_selection_mode" in self.last_query:
            return ("manual", 3)
        if "FROM exam_setting" in self.last_query:
            return None
        if "SELECT question_text" in self.last_query:
            return ("Snapshot text", "MCQ")
        return None

    def fetchall(self):
        if "FROM exam_question" in self.last_query:
            return [(11, 3)]
        if "FROM options" in self.last_query:
            return [(101, "A", True), (102, "B", False)]
        return []

    def close(self):
        pass


class _CreateConnection:
    def __init__(self):
        self.cursor_instance = _CreateCursor()

    def cursor(self, **_kwargs):
        return self.cursor_instance

    def start_transaction(self):
        pass

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


class StudentExamFlowTests(unittest.TestCase):
    def test_verify_code_returns_only_fullscreen_related_settings(self):
        with (
            patch.object(ExamController, "_validateStudentExamAccess", return_value={}) as validate,
            patch.object(examModel, "getExamSettings", return_value={
                "force_fullscreen_thresh": 3,
                "tab_switch_thresh": 2,
                "copy_paste_thresh": 1,
                "auto_submit_on_expire": True,
            }),
        ):
            result = ExamController.verifyExamCode("S1", "student", 5, "CODE")

        validate.assert_called_once_with("S1", "student", 5, "CODE")
        self.assertEqual(result["examId"], 5)
        self.assertTrue(result["requiresFullscreen"])
        self.assertEqual(result["settings"], {
            "force_fullscreen_thresh": 3,
            "tab_switch_thresh": 2,
            "copy_paste_thresh": 1,
        })

    def test_open_attempt_resumes_when_max_attempt_is_reached(self):
        exam = {
            "exam_id": 5,
            "examcode": "CODE",
            "max_attempt": 1,
            "duration_minutes": 60,
            "start_time": None,
            "end_time": None,
        }
        attempt = {
            "attempt_id": 10,
            "attempt_no": 1,
            "start_time": datetime.now() - timedelta(minutes=5),
            "status": "in_progress",
        }
        with (
            patch.object(examModel, "getExamById", return_value=exam),
            patch.object(examModel, "isStudentAssignedToExam", return_value=True),
            patch.object(examModel, "getOpenAttempt", return_value=attempt),
            patch.object(examModel, "countStudentAttempts", return_value=1),
            patch.object(examModel, "validateExamQuestionPoints") as validate_points,
            patch.object(examModel, "get_database_now", return_value=datetime(2026, 7, 28, 5, 0)),
            patch("src.controller.teacherController.examController.userModel.getUserBySchoolId", return_value={"id": 7}),
        ):
            result = ExamController.startExam("S1", "student", 5, "code")

        self.assertEqual((result["attemptId"], result["attemptNo"]), (10, 1))
        self.assertTrue(result["resumed"])
        validate_points.assert_not_called()

    def test_timer_uses_attempt_start_time(self):
        database_now = datetime(2026, 7, 28, 5, 0)
        start_time = database_now - timedelta(minutes=10)
        timer = ExamController._timer_payload(
            {"duration_minutes": 60, "end_time": None}, {"start_time": start_time}, database_now
        )
        self.assertEqual(timer["serverTime"], "2026-07-28T05:00:00Z")
        self.assertEqual(timer["expiresAt"], "2026-07-28T05:50:00Z")
        self.assertEqual(timer["remainingSeconds"], 3000)

    def test_attempt_questions_use_snapshot_and_never_expose_correct_answer(self):
        snapshot_row = {
            "question_id": 11,
            "question_text": "Live text",
            "question_type": "MCQ",
            "question_point": 2,
            "question_text_snapshot": "Snapshot text",
            "question_type_snapshot": "MCQ",
            "question_point_snapshot": 3,
            "options_snapshot": '[{"id": 101, "text": "A", "isCorrect": true, "displayOrder": 1}]',
            "selected_option_id": 101,
            "answer_text": None,
        }
        with patch.object(examModel, "get_db_connection", return_value=_Connection([snapshot_row])):
            questions = examModel.getExamQuestions(5, 10)

        self.assertEqual(questions[0]["text"], "Snapshot text")
        self.assertEqual(questions[0]["points"], 3)
        self.assertEqual(questions[0]["options"], [{"id": 101, "text": "A"}])
        self.assertEqual(questions[0]["savedAnswer"], {"selectedOptionId": 101})
        self.assertNotIn("isCorrect", str(questions))

    def test_start_creates_question_snapshots_for_every_selected_question(self):
        connection = _CreateConnection()
        with patch.object(examModel, "get_db_connection", return_value=connection):
            attempt_id = examModel.createAttempt(5, 7, 1)

        self.assertEqual(attempt_id, 10)
        self.assertEqual(len(connection.cursor_instance.inserted_rows), 1)
        inserted = connection.cursor_instance.inserted_rows[0]
        self.assertEqual(inserted[4:7], ("Snapshot text", "MCQ", 3))
        self.assertIn('"isCorrect": true', inserted[7])

    def test_my_exams_marks_an_open_attempt_as_resumable(self):
        row = {
            "exam_id": 5,
            "id": 5,
            "title": "Exam",
            "examcode": "CODE",
            "description": None,
            "duration_minutes": 60,
            "max_attempt": 1,
            "attempts_used": 1,
            "start_time": None,
            "end_time": None,
            "result_visibility": "full",
            "open_attempt_id": 10,
            "open_attempt_start_time": datetime(2026, 7, 28, 4, 55),
        }
        with (
            patch.object(examModel, "get_db_connection", return_value=_Connection([row])),
            patch.object(examModel, "get_database_now", return_value=datetime(2026, 7, 28, 5, 0)),
        ):
            exams = examModel.getStudentExams("S1")

        self.assertEqual(exams[0]["status"], "open")
        self.assertTrue(exams[0]["has_open_attempt"])
        self.assertEqual(exams[0]["open_attempt_id"], 10)
        self.assertTrue(exams[0]["can_resume"])

    def test_restore_rejects_another_students_attempt(self):
        with (
            patch("src.controller.teacherController.examController.userModel.getUserBySchoolId", return_value={"id": 7}),
            patch.object(examModel, "getAssignedExamById", return_value={"exam_id": 5}),
            patch.object(examModel, "getAttemptById", return_value={"exam_id": 5, "student_id": 9}),
        ):
            with self.assertRaisesRegex(Exception, "Attempt does not belong to student"):
                ExamController.restoreAttempt("S1", "student", 5, 10)

    def test_restore_returns_owned_attempt_snapshot(self):
        attempt = {
            "attempt_id": 10,
            "attempt_no": 1,
            "exam_id": 5,
            "student_id": 7,
            "status": "in_progress",
            "start_time": datetime.now(),
            "last_saved_at": None,
        }
        with (
            patch("src.controller.teacherController.examController.userModel.getUserBySchoolId", return_value={"id": 7}),
            patch.object(examModel, "getAssignedExamById", return_value={"exam_id": 5, "duration_minutes": 60, "end_time": None}),
            patch.object(examModel, "getAttemptById", return_value=attempt),
            patch.object(examModel, "getExamQuestions", return_value=[]),
            patch.object(examModel, "getExamSettings", return_value={}),
            patch.object(examModel, "get_database_now", return_value=attempt["start_time"]),
        ):
            result = ExamController.restoreAttempt("S1", "student", 5, 10)

        self.assertEqual(result["attempt"]["attempt_id"], 10)
        self.assertEqual(result["attempt"]["status"], "in_progress")
        self.assertIn("remainingSeconds", result)

    def test_submit_allows_unanswered_questions_and_finalizes_once(self):
        exam = {"exam_id": 5, "duration_minutes": 60, "end_time": None}
        attempt = {
            "attempt_id": 10, "exam_id": 5, "student_id": 7, "status": "in_progress",
            "submitted_at": None, "end_time": None, "start_time": datetime.now(),
        }
        finalized = {"score": 3, "essayPending": False, "status": "submitted", "idempotent": False}
        with (
            patch.object(ExamController, "_owned_attempt", return_value=(exam, attempt)),
            patch.object(examModel, "finalizeAttempt", return_value=finalized) as finalize,
            patch.object(examModel, "get_database_now", return_value=attempt["start_time"]),
        ):
            result = ExamController.submitExam("S1", "student", 5, 10, [])

        finalize.assert_called_once_with(10, 5, [])
        self.assertEqual((result["score"], result["status"]), (3, "submitted"))

    def test_expired_attempt_does_not_save_new_answer(self):
        exam = {"exam_id": 5, "duration_minutes": 1, "end_time": None}
        attempt = {
            "attempt_id": 10, "exam_id": 5, "student_id": 7, "status": "in_progress",
            "submitted_at": None, "end_time": None, "start_time": datetime.now() - timedelta(minutes=2),
        }
        with (
            patch.object(ExamController, "_owned_attempt", return_value=(exam, attempt)),
            patch.object(examModel, "getExamSettings", return_value={"auto_submit_on_expire": True}),
            patch.object(examModel, "finalizeAttempt") as finalize,
            patch.object(examModel, "saveAttemptAnswer") as save,
            patch.object(examModel, "get_database_now", return_value=datetime.now()),
        ):
            with self.assertRaisesRegex(Exception, "Attempt has expired"):
                ExamController.saveAnswer("S1", "student", 5, 10, 11, {"selectedOptionId": 101})

        finalize.assert_called_once_with(10, 5, [])
        save.assert_not_called()

    def test_terminate_finalizes_latest_answers_once(self):
        attempt = {"attempt_id": 10, "exam_id": 5, "student_id": 7, "status": "in_progress", "start_time": datetime.now(), "submitted_at": None, "end_time": None}
        finalized = {"score": 2, "essayPending": False, "status": "terminated", "idempotent": False}
        with (
            patch.object(ExamController, "_owned_attempt", return_value=({"duration_minutes": 60, "end_time": None}, attempt)),
            patch.object(examModel, "finalizeAttempt", return_value=finalized) as finalize,
            patch.object(examModel, "get_database_now", return_value=attempt["start_time"]),
        ):
            result = ExamController.terminateAttempt(
                "S1", "student", 5, 10, "anti_cheat", "tab-switch",
                [{"questionId": 11, "selectedOptionId": 101}],
            )

        finalize.assert_called_once_with(10, 5, [{"questionId": 11, "selectedOptionId": 101}], "terminated", "anti_cheat:tab-switch")
        self.assertEqual(result["status"], "terminated")


if __name__ == "__main__":
    unittest.main()
