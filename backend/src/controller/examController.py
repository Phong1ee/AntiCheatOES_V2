import src.models.examModel as examModel
import src.models.userModel as userModel
from datetime import datetime


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

        now_time = datetime.now()
        start_time = exam["start_time"]
        end_time = exam["end_time"]

        if start_time and now_time < start_time:
            raise Exception("Exam is not open yet")

        if end_time and now_time > end_time:
            raise Exception("Exam has closed")

        if exam["examcode"].strip().lower() != code.strip().lower():
            raise Exception("Incorrect exam code")

        attempts_used = examModel.countStudentAttempts(exam_id, user["id"])
        max_attempt = exam["max_attempt"]

        if max_attempt is not None and int(max_attempt) > 0 and attempts_used >= int(max_attempt):
            raise Exception("Maximum attempts exceeded")

        return {
            "user": user,
            "exam": exam,
            "attempts_used": attempts_used,
        }

    @staticmethod
    def getStudentExams(school_id: str, role: str):
        """Get all exams assigned to a student."""
        try:
            if role != "student":
                raise Exception("Only students can view assigned exams")

            exams = examModel.getStudentExams(school_id)
            return {
                "success": True,
                "exams": exams
            }
        except Exception as e:
            raise e

    @staticmethod
    def getExamWithQuestions(school_id: str, role: str, exam_id: int):
        """Get exam details and questions for an assigned student exam."""
        try:
            if role != "student":
                raise Exception("Only students can view assigned exams")

            exam = examModel.getAssignedExamById(school_id, exam_id)
            if not exam:
                raise Exception("Exam not found or not assigned to student")

            questions = examModel.getExamQuestions(exam_id)

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

            ExamController._validateStudentExamAccess(school_id, "student", exam_id, code)

            return {
                "success": True,
                "message": "Exam code verified",
                "exam_id": exam_id
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

            open_attempt = examModel.getOpenAttempt(exam_id, user["id"])
            if open_attempt:
                return {
                    "success": True,
                    "attempt_id": open_attempt["attempt_id"],
                    "attempt_no": open_attempt["attempt_no"],
                    "exam_id": exam_id,
                    "duration_minutes": exam["duration_minutes"]
                }

            attempt_no = attempts_used + 1
            attempt_id = examModel.createAttempt(exam_id, user["id"], attempt_no)

            return {
                "success": True,
                "attempt_id": attempt_id,
                "attempt_no": attempt_no,
                "exam_id": exam_id,
                "duration_minutes": exam["duration_minutes"]
            }
        except Exception as e:
            raise e

    @staticmethod
    def submitExam(school_id: str, role: str, exam_id: int, attempt_id: int, answers: list):
        """Submit an attempt, save MCQ and essay answers, and close the attempt."""
        try:
            if role != "student":
                raise Exception("Only students can submit exams")

            user = userModel.getUserBySchoolId(school_id)
            if not user:
                raise Exception("User not found")

            attempt = examModel.getAttemptById(attempt_id)
            if not attempt:
                raise Exception("Attempt not found")

            if int(attempt["exam_id"]) != int(exam_id):
                raise Exception("Attempt does not belong to this exam")

            if int(attempt["student_id"]) != int(user["id"]):
                raise Exception("Attempt does not belong to student")

            if attempt["submitted_at"] is not None:
                raise Exception("Attempt already submitted")

            result = examModel.submitAttempt(attempt_id, exam_id, answers)

            return {
                "success": True,
                "message": "Exam submitted successfully",
                "attemptId": attempt_id,
                "score": result["score"],
                "essayPending": result["essayPending"]
            }
        except Exception as e:
            raise e

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
