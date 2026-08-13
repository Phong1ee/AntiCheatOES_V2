import src.models.teacher.examModel as examModel
import src.models.userModel as userModel
from datetime import timedelta
from src.service.cache_service import cache_aside, student_exam_list_key


class ExamController:
    @staticmethod
    def _validateStudentExamAccess(school_id: str, role: str, exam_id: int, code: str | None):
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

        required_code = exam.get("examcode")
        if required_code and required_code.strip().lower() != (code or "").strip().lower():
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
            # MySQL NOW() and exam schedule fields are local naive DATETIME values.
            # Do not label them UTC or browser date parsing shifts the comparison.
            "serverTime": server_time.replace(microsecond=0).isoformat(),
            "expiresAt": expires_at.replace(microsecond=0).isoformat(),
            "remainingSeconds": remaining_seconds,
        }

    @staticmethod
    def _start_response(exam: dict, attempt: dict, resumed: bool, database_now=None, session_token: str | None = None) -> dict:
        settings = examModel.getExamSettings(exam["exam_id"])
        anti_cheat_enabled = bool(settings.get("anti_cheat_enabled", False))
        violation_limit = int(settings.get("violation_limit") or 5)
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
            "antiCheatEnabled": anti_cheat_enabled,
            "violationCount": int(attempt.get("violation_count") or 0),
            "violationLimit": violation_limit,
            "sessionToken": session_token,
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
    def _expire_if_needed(
        exam: dict, attempt: dict, attempt_id: int, exam_id: int, submit_request_id: str | None = None,
    ) -> bool:
        if ExamController._timer_payload(exam, attempt, examModel.get_database_now())["remainingSeconds"] > 0:
            return False
        settings = examModel.getExamSettings(exam_id)
        if settings.get("auto_submit_on_expire", True):
            if submit_request_id:
                examModel.finalizeAttempt(attempt_id, exam_id, [], submit_request_id=submit_request_id)
            else:
                examModel.finalizeAttempt(attempt_id, exam_id, [])
        return True

    @staticmethod
    def getStudentExams(school_id: str, role: str):
        """Get all exams assigned to a student."""
        exams = cache_aside(
            student_exam_list_key(school_id),
            30,
            lambda: examModel.getStudentExams(school_id),
        )
        server_time = examModel.get_database_now()
        return {
            "success": True,
            "serverTime": f"{server_time.replace(microsecond=0).isoformat()}Z",
            "exams": exams,
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
    def verifyExamCode(school_id: str, role: str, exam_id: int, code: str | None):
        """Verify exam code for an assigned student without creating an attempt."""
        try:
            if role != "student":
                raise Exception("Only students can verify exam codes")

            validated = ExamController._validateStudentExamAccess(school_id, "student", exam_id, code)
            settings = {"sequential_navigation": False, **examModel.getExamSettings(exam_id)}

            return {
                "success": True,
                "message": "Exam code verified",
                "exam_id": exam_id,
                "examId": exam_id,
                "requiresFullscreen": bool(settings.get("anti_cheat_enabled", False)),
                "antiCheatEnabled": bool(settings.get("anti_cheat_enabled", False)),
                "violationLimit": int(settings.get("violation_limit") or 5),
                "settings": {
                    "anti_cheat_enabled": bool(settings.get("anti_cheat_enabled", False)),
                    "violation_limit": int(settings.get("violation_limit") or 5),
                    "sequential_navigation": bool(settings["sequential_navigation"]),
                },
            }
        except Exception as e:
            raise e

    @staticmethod
    def startExam(school_id: str, role: str, exam_id: int, code: str | None, device_id: str = ""):
        """Start an exam and create or reuse an open attempt."""
        try:
            validated = ExamController._validateStudentExamAccess(school_id, role, exam_id, code)
            user = validated["user"]
            exam = validated["exam"]
            attempts_used = validated["attempts_used"]

            open_attempt = validated["open_attempt"]
            if open_attempt:
                if not device_id:
                    return ExamController._start_response(exam, open_attempt, resumed=True, database_now=validated["database_now"])
                raise Exception("Open attempt must be resumed")

            attempt_no = attempts_used + 1
            session_token = examModel.create_attempt_session_token()
            attempt_id = examModel.createAttempt(
                exam_id,
                user.get("school_id", school_id),
                attempt_no,
                device_id,
                session_token,
                code,
            )
            attempt = examModel.getAttemptById(attempt_id)
            if not attempt:
                raise Exception("Attempt not found")
            if attempt.get("session_token_hash") != examModel._sha256(session_token):
                if not device_id:
                    return ExamController._start_response(
                        exam, attempt, resumed=True, database_now=examModel.get_database_now()
                    )
                raise Exception("Open attempt must be resumed")
            return ExamController._start_response(exam, attempt, resumed=False, database_now=examModel.get_database_now(), session_token=session_token)
        except Exception as e:
            raise e

    @staticmethod
    def restoreAttempt(school_id: str, role: str, exam_id: int, attempt_id: int, device_id: str = "", session_token: str = ""):
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
        if device_id and session_token:
            examModel.assertAttemptSession(exam_id, attempt_id, school_id, device_id, session_token)

        settings = {"sequential_navigation": False, **examModel.getExamSettings(exam_id)}
        anti_cheat_enabled = bool(settings.get("anti_cheat_enabled", False))
        violation_limit = int(settings.get("violation_limit") or 5)
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
                "antiCheatEnabled": anti_cheat_enabled,
                "violationCount": int(attempt.get("violation_count") or 0),
                "violationLimit": violation_limit,
                "settings": settings,
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
                "violationCount": int(attempt.get("violation_count") or 0),
            },
            "antiCheatEnabled": anti_cheat_enabled,
            "violationCount": int(attempt.get("violation_count") or 0),
            "violationLimit": violation_limit,
            **timer,
            "settings": settings,
            "questions": examModel.getExamQuestions(exam_id, attempt_id),
        }

    @staticmethod
    def submitExam(
        school_id: str, role: str, exam_id: int, attempt_id: int, answers: list,
        device_id: str = "", session_token: str = "", submit_request_id: str | None = None,
    ):
        """Submit an attempt, save MCQ and essay answers, and close the attempt."""
        try:
            exam, attempt = ExamController._owned_attempt(school_id, role, exam_id, attempt_id)
            if device_id and session_token:
                examModel.assertAttemptSession(exam_id, attempt_id, school_id, device_id, session_token)
            if attempt["status"] not in {"in_progress", "submitted", "terminated"}:
                raise Exception("Attempt is no longer in progress")
            expired = ExamController._expire_if_needed(
                exam, attempt, attempt_id, exam_id, submit_request_id=submit_request_id
            )
            result = examModel.finalizeAttempt(
                attempt_id, exam_id, [] if expired else answers, submit_request_id=submit_request_id
            )

            return {
                "success": True,
                "message": "Exam submitted successfully" if not expired else "Exam auto-submitted after expiry",
                "attemptId": attempt_id,
                "score": result["score"],
                "essayPending": result["essayPending"],
                "resultVisibility": str(exam.get("result_visibility") or "hidden"),
                "status": result["status"],
                "submitRequestId": result.get("submitRequestId"),
            }
        except Exception as e:
            raise e

    @staticmethod
    def saveAnswer(school_id: str, role: str, exam_id: int, attempt_id: int, question_id: int, answer: dict, device_id: str = "", session_token: str = ""):
        exam, attempt = ExamController._owned_attempt(school_id, role, exam_id, attempt_id)
        if device_id and session_token:
            examModel.assertAttemptSession(exam_id, attempt_id, school_id, device_id, session_token)
        if attempt["status"] != "in_progress" or attempt["submitted_at"] or attempt["end_time"]:
            raise Exception("Attempt is no longer in progress")
        if ExamController._expire_if_needed(exam, attempt, attempt_id, exam_id):
            raise Exception("Attempt has expired")
        save_result = examModel.saveAttemptAnswer(attempt_id, exam_id, question_id, answer)
        return {
            "success": True,
            "attemptId": attempt_id,
            "questionId": question_id,
            "savedAt": save_result["savedAt"],
            "stale": save_result["stale"],
            "storedRevision": save_result["storedRevision"],
        }

    @staticmethod
    def terminateAttempt(school_id: str, role: str, exam_id: int, attempt_id: int, reason: str, violation_type: str | None, answers: list, device_id: str = "", session_token: str = ""):
        if device_id and session_token:
            examModel.assertAttemptSession(exam_id, attempt_id, school_id, device_id, session_token)
        del school_id, role, exam_id, attempt_id, reason, violation_type, answers, device_id, session_token
        # A browser may report a violation, but cannot declare its own attempt terminated.
        raise Exception("Client-controlled termination is not allowed")

    @staticmethod
    def recordAntiCheatEvent(school_id: str, role: str, exam_id: int, event: dict, device_id: str, session_token: str):
        if role != "student":
            raise Exception("Only students can manage exam attempts")
        return examModel.recordAntiCheatEvent(exam_id, school_id, event, device_id, session_token)

    @staticmethod
    def resumeAttempt(
        school_id: str, role: str, exam_id: int, attempt_id: int, device_id: str,
        resume_cause: str, client_event_id: str | None,
    ):
        if role != "student":
            raise Exception("Only students can manage exam attempts")
        exam = examModel.getAssignedExamById(school_id, exam_id)
        if not exam:
            raise Exception("Exam not found or not assigned to student")
        now_time = examModel.get_database_now()
        if exam.get("start_time") and now_time < exam["start_time"]:
            raise Exception("Exam is not open yet")
        if exam.get("end_time") and now_time > exam["end_time"]:
            raise Exception("Exam has closed")
        attempt, session_token, _claimed_legacy = examModel.resumeAttempt(exam_id, attempt_id, school_id, device_id)
        settings = examModel.getExamSettings(exam_id)
        event_state = None
        if resume_cause == "page_refresh" and settings.get("anti_cheat_enabled"):
            event_state = examModel.recordAntiCheatEvent(
                exam_id,
                school_id,
                {
                    "attemptId": attempt_id,
                    "clientEventId": client_event_id,
                    "eventType": "PAGE_REFRESH",
                    "source": "browser",
                    "details": "Resume after page refresh",
                    "metadata": {"resumeCause": resume_cause},
                    "answers": [],
                },
                device_id,
                session_token,
            )
        return {
            "success": True,
            "attemptId": attempt_id,
            "sessionToken": session_token,
            "antiCheatEnabled": bool(settings.get("anti_cheat_enabled", False)),
            "violationCount": event_state["violationCount"] if event_state else int(attempt.get("violation_count") or 0),
            "violationLimit": int(settings.get("violation_limit") or 5),
            "terminated": event_state["terminated"] if event_state else attempt["status"] == "terminated",
            "attemptStatus": event_state["attemptStatus"] if event_state else attempt["status"],
        }

    @staticmethod
    def heartbeatAttempt(school_id: str, role: str, exam_id: int, attempt_id: int, device_id: str, session_token: str):
        if role != "student":
            raise Exception("Only students can manage exam attempts")
        state = examModel.heartbeatAttempt(exam_id, attempt_id, school_id, device_id, session_token)
        return {"success": True, "attemptId": attempt_id, "attemptStatus": state["status"], "violationCount": int(state["violation_count"] or 0), "lastHeartbeatAt": state["last_heartbeat_at"]}

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
