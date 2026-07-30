import src.models.teacher.examModel as examModel
import src.models.userModel as userModel
from datetime import timedelta


class ExamController:
    @staticmethod
    def _validateStudentExamAccess(school_id: str, role: str, exam_id: int, code: str):
        if role != "student":
            raise Exception("Only students can start exams")

        user = userModel.getUserBySchoolId(school_id)
        if not user:
            raise Exception("User not found")

        exam = examModel.getExamById(exam_id)
        if not exam:
            raise Exception("Exam not found")

        is_assigned = examModel.isStudentAssignedToExam(school_id, exam_id)
        if not is_assigned:
            raise Exception("Exam not assigned to student")

        now_time = examModel.get_database_now()
        start_time = exam["start_time"]
        end_time = exam["end_time"]

        if start_time and now_time < start_time:
            raise Exception("Exam is not open yet")

        if end_time and now_time > end_time:
            raise Exception("Exam has closed")

        if exam["examcode"].strip().lower() != code.strip().lower():
            raise Exception("Incorrect exam code")

        open_attempt = examModel.getOpenAttempt(exam_id, user.get("school_id", school_id))
        if open_attempt and ExamController._timer_payload(exam, open_attempt, now_time)["remainingSeconds"] <= 0:
            # The row lock in finalizeAttempt makes racing Start/auto-submit requests idempotent.
            examModel.finalizeAttempt(open_attempt["attempt_id"], exam_id, [])
            open_attempt = None
        attempts_used = examModel.countStudentAttempts(exam_id, user.get("school_id", school_id))
        max_attempt = exam["max_attempt"]

        if not open_attempt and max_attempt is not None and int(max_attempt) > 0 and attempts_used >= int(max_attempt):
            raise Exception("Maximum attempts exceeded")

        if not open_attempt:
            examModel.validateExamQuestionPoints(exam_id)

        return {
            "user": user,
            "exam": exam,
            "attempts_used": attempts_used,
            "open_attempt": open_attempt,
            "database_now": now_time,
        }

    @staticmethod
    def _timer_payload(exam: dict, attempt: dict, database_now=None) -> dict:
        """Calculate the exam clock from server-side timestamps only."""
        server_time = database_now or examModel.get_database_now()
        start_time = attempt.get("start_time") or server_time
        duration_expiry = start_time + timedelta(minutes=int(exam["duration_minutes"] or 0))
        exam_end = exam.get("end_time")
        expires_at = min(duration_expiry, exam_end) if exam_end else duration_expiry
        remaining_seconds = max(0, int((expires_at - server_time).total_seconds()))
        return {
            "serverTime": f"{server_time.replace(microsecond=0).isoformat()}Z",
            "expiresAt": f"{expires_at.replace(microsecond=0).isoformat()}Z",
            "remainingSeconds": remaining_seconds,
        }

    @staticmethod
    def _start_response(exam: dict, attempt: dict, resumed: bool, database_now=None) -> dict:
        return {
            "success": True,
            "exam_id": exam["exam_id"],
            "attempt_id": attempt["attempt_id"],
            "attempt_no": attempt["attempt_no"],
            "duration_minutes": exam["duration_minutes"],
            "examId": exam["exam_id"],
            "attemptId": attempt["attempt_id"],
            "attemptNo": attempt["attempt_no"],
            "resumed": resumed,
            "status": attempt.get("status", "in_progress"),
            **ExamController._timer_payload(exam, attempt, database_now),
        }

    @staticmethod
    def _owned_attempt(school_id: str, role: str, exam_id: int, attempt_id: int):
        if role != "student":
            raise Exception("Only students can manage exam attempts")
        user = userModel.getUserBySchoolId(school_id)
        exam = examModel.getAssignedExamById(school_id, exam_id)
        attempt = examModel.getAttemptById(attempt_id)
        if not user:
            raise Exception("User not found")
        if not exam:
            raise Exception("Exam not found or not assigned to student")
        if not attempt or int(attempt["exam_id"]) != int(exam_id) or attempt["student_id"] != user.get("school_id", school_id):
            raise Exception("Attempt does not belong to student")
        return exam, attempt

    @staticmethod
    def _expire_if_needed(exam: dict, attempt: dict, attempt_id: int, exam_id: int) -> bool:
        if ExamController._timer_payload(exam, attempt, examModel.get_database_now())["remainingSeconds"] > 0:
            return False
        settings = examModel.getExamSettings(exam_id)
        if settings.get("auto_submit_on_expire", True):
            examModel.finalizeAttempt(attempt_id, exam_id, [])
        return True

    @staticmethod
    def getStudentExams(school_id: str, role: str):
        """Get all exams assigned to a student."""
        exams = examModel.getStudentExams(school_id)
        return {
            "success": True,
            "exams": exams
        }


    @staticmethod
    def getExamWithQuestions(
        school_id: str, role: str, exam_id: int, attempt_id: int | None = None
    ):
        """Get exam details and questions for an assigned student exam."""
        try:
            if role != "student":
                raise Exception("Only students can view assigned exams")

            exam = examModel.getAssignedExamById(school_id, exam_id)
            if not exam:
                raise Exception("Exam not found or not assigned to student")

            if attempt_id is not None:
                attempt = examModel.getAttemptById(attempt_id)
                user = userModel.getUserBySchoolId(school_id)
                if (
                    not attempt
                    or not user
                    or int(attempt["exam_id"]) != int(exam_id)
                    or attempt["student_id"] != user.get("school_id", school_id)
                ):
                    raise Exception("Attempt does not belong to student")
            questions = examModel.getExamQuestions(exam_id, attempt_id)

            return {
                "success": True,
                "exam": exam,
                "questions": questions
            }
        except Exception as e:
            raise e

    @staticmethod
    def verifyExamCode(school_id: str, role: str, exam_id: int, code: str):
        """Verify exam code for an assigned student without creating an attempt."""
        try:
            if role != "student":
                raise Exception("Only students can verify exam codes")

            validated = ExamController._validateStudentExamAccess(school_id, "student", exam_id, code)
            settings = examModel.getExamSettings(exam_id)

            return {
                "success": True,
                "message": "Exam code verified",
                "exam_id": exam_id,
                "examId": exam_id,
                "requiresFullscreen": int(settings.get("force_fullscreen_thresh") or 0) > 0,
                "settings": {
                    "force_fullscreen_thresh": int(settings.get("force_fullscreen_thresh") or 0),
                    "tab_switch_thresh": int(settings.get("tab_switch_thresh") or 0),
                    "copy_paste_thresh": int(settings.get("copy_paste_thresh") or 0),
                },
            }
        except Exception as e:
            raise e

    @staticmethod
    def startExam(school_id: str, role: str, exam_id: int, code: str):
        """Start an exam and create or reuse an open attempt."""
        try:
            validated = ExamController._validateStudentExamAccess(school_id, role, exam_id, code)
            user = validated["user"]
            exam = validated["exam"]
            attempts_used = validated["attempts_used"]

            open_attempt = validated["open_attempt"]
            if open_attempt:
                return ExamController._start_response(exam, open_attempt, resumed=True, database_now=validated["database_now"])

            attempt_no = attempts_used + 1
            attempt_id = examModel.createAttempt(exam_id, user.get("school_id", school_id), attempt_no)
            attempt = examModel.getAttemptById(attempt_id)
            if not attempt:
                raise Exception("Attempt not found")
            return ExamController._start_response(exam, attempt, resumed=False, database_now=examModel.get_database_now())
        except Exception as e:
            raise e

    @staticmethod
    def restoreAttempt(school_id: str, role: str, exam_id: int, attempt_id: int):
        """Restore an assigned student's attempt without modifying its state."""
        if role != "student":
            raise Exception("Only students can view assigned exams")

        user = userModel.getUserBySchoolId(school_id)
        exam = examModel.getAssignedExamById(school_id, exam_id)
        attempt = examModel.getAttemptById(attempt_id)
        if not exam:
            raise Exception("Exam not found or not assigned to student")
        if (
            not user
            or not attempt
            or int(attempt["exam_id"]) != int(exam_id)
            or attempt["student_id"] != user.get("school_id", school_id)
        ):
            raise Exception("Attempt does not belong to student")

        timer = ExamController._timer_payload(exam, attempt, examModel.get_database_now())
        if attempt["status"] == "in_progress" and timer["remainingSeconds"] <= 0:
            examModel.finalizeAttempt(attempt_id, exam_id, [])
            attempt = examModel.getAttemptById(attempt_id) or attempt
            return {
                "success": False,
                "expired": True,
                "exam": exam,
                "attempt": {"attempt_id": attempt_id, "attempt_no": attempt["attempt_no"], "status": attempt["status"], "start_time": attempt["start_time"], "lastSavedAt": attempt.get("last_saved_at")},
                **{**timer, "remainingSeconds": 0},
                "questions": [],
            }

        return {
            "success": True,
            "exam": exam,
            "attempt": {
                "attempt_id": attempt["attempt_id"],
                "attempt_no": attempt["attempt_no"],
                "status": attempt["status"],
                "start_time": attempt["start_time"],
                "lastSavedAt": attempt.get("last_saved_at"),
            },
            **timer,
            "settings": examModel.getExamSettings(exam_id),
            "questions": examModel.getExamQuestions(exam_id, attempt_id),
        }

    @staticmethod
    def submitExam(school_id: str, role: str, exam_id: int, attempt_id: int, answers: list):
        """Submit an attempt, save MCQ and essay answers, and close the attempt."""
        try:
            exam, attempt = ExamController._owned_attempt(school_id, role, exam_id, attempt_id)
            if attempt["status"] not in {"in_progress", "submitted", "terminated"}:
                raise Exception("Attempt is no longer in progress")
            expired = ExamController._expire_if_needed(exam, attempt, attempt_id, exam_id)
            result = examModel.finalizeAttempt(attempt_id, exam_id, [] if expired else answers)

            return {
                "success": True,
                "message": "Exam submitted successfully" if not expired else "Exam auto-submitted after expiry",
                "attemptId": attempt_id,
                "score": result["score"],
                "essayPending": result["essayPending"],
                "status": result["status"],
            }
        except Exception as e:
            raise e

    @staticmethod
    def saveAnswer(school_id: str, role: str, exam_id: int, attempt_id: int, question_id: int, answer: dict):
        exam, attempt = ExamController._owned_attempt(school_id, role, exam_id, attempt_id)
        if attempt["status"] != "in_progress" or attempt["submitted_at"] or attempt["end_time"]:
            raise Exception("Attempt is no longer in progress")
        if ExamController._expire_if_needed(exam, attempt, attempt_id, exam_id):
            raise Exception("Attempt has expired")
        saved_at = examModel.saveAttemptAnswer(attempt_id, exam_id, question_id, answer)
        return {
            "success": True,
            "attemptId": attempt_id,
            "questionId": question_id,
            "savedAt": saved_at,
        }

    @staticmethod
    def terminateAttempt(school_id: str, role: str, exam_id: int, attempt_id: int, reason: str, violation_type: str | None, answers: list):
        exam, attempt = ExamController._owned_attempt(school_id, role, exam_id, attempt_id)
        if attempt["status"] in {"submitted", "terminated"}:
            return {"success": True, "attemptId": attempt_id, "status": attempt["status"], "idempotent": True}
        if ExamController._expire_if_needed(exam, attempt, attempt_id, exam_id):
            expired = examModel.getAttemptById(attempt_id)
            return {"success": True, "attemptId": attempt_id, "status": expired["status"] if expired else "submitted", "idempotent": True}
        termination_reason = reason if not violation_type else f"{reason}:{violation_type}"
        result = examModel.finalizeAttempt(attempt_id, exam_id, answers, "terminated", termination_reason)
        return {
            "success": True,
            "attemptId": attempt_id,
            "status": result["status"],
            "score": result["score"],
            "essayPending": result["essayPending"],
            "idempotent": result["idempotent"],
        }

    @staticmethod
    def getStudentExam(school_id: str):
        """Get exam details for a student based on their school ID."""
        try:
            exam_details = examModel.getExam()
            return {
                "success": True,
                "exam": exam_details
            }
        except Exception as e:
            raise e

    @staticmethod
    def addQuestionToExam(exam_id: int, question_data: dict):
        """Add a question to an exam."""
        try:
            examModel.addQuestionToExam(exam_id, question_data)
            return {
                "success": True,
                "message": "Question added to exam successfully"
            }
        except Exception as e:
            raise e
