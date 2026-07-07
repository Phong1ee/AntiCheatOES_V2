from datetime import datetime

import src.models.resultModel as resultModel
import src.models.userModel as userModel


class ResultsController:
    @staticmethod
    def _format_time_taken(start_time, end_time):
        if not start_time or not end_time:
            return "0m 0s"

        total_seconds = max(int((end_time - start_time).total_seconds()), 0)
        minutes = total_seconds // 60
        seconds = total_seconds % 60
        return f"{minutes}m {seconds}s"

    @staticmethod
    def _resolve_visibility(result_visibility: str):
        if result_visibility == "hidden":
            return {
                "scoreVisible": False,
                "allowViewDetails": False,
            }

        if result_visibility == "score-only":
            return {
                "scoreVisible": True,
                "allowViewDetails": False,
            }

        return {
            "scoreVisible": True,
            "allowViewDetails": True,
        }

    @staticmethod
    def _build_result_summary(attempt: dict):
        visibility = ResultsController._resolve_visibility(
            attempt["result_visibility"]
        )
        total_questions = resultModel.getExamQuestionCount(attempt["exam_id"])
        correct_answers = resultModel.getCorrectMcqCount(attempt["attempt_id"])
        subject = resultModel.getExamSubject(attempt["exam_id"])
        essay_pending = resultModel.hasPendingEssay(attempt["attempt_id"])

        if attempt["result_visibility"] == "hidden":
            status = "hidden"
        elif essay_pending or attempt["submitted_at"] is None:
            status = "pending"
        else:
            status = "published"

        result_time = (
            attempt["submitted_at"]
            or attempt["end_time"]
            or attempt["start_time"]
            or datetime.now()
        )
        end_time = attempt["submitted_at"] or attempt["end_time"]

        return {
            "id": attempt["attempt_id"],
            "attemptId": attempt["attempt_id"],
            "examId": attempt["exam_id"],
            "examTitle": attempt["exam_title"],
            "subject": subject,
            "date": result_time.isoformat(),
            "duration": f'{int(attempt["duration_minutes"] or 0)} mins',
            "status": status,
            "score": None
            if attempt["result_visibility"] == "hidden"
            else (
                float(attempt["score"])
                if attempt["score"] is not None
                else None
            ),
            "correctAnswers": None
            if attempt["result_visibility"] == "hidden"
            else correct_answers,
            "totalQuestions": total_questions,
            "timeTaken": ResultsController._format_time_taken(
                attempt["start_time"], end_time
            ),
            "attemptNumber": attempt["attempt_no"],
            "maxAttempts": attempt["max_attempt"],
            "scoreVisible": visibility["scoreVisible"],
            "allowViewDetails": visibility["allowViewDetails"],
            "essayPending": essay_pending,
        }

    @staticmethod
    def getStudentResults(school_id: str, role: str):
        """Get all student attempt results with exam visibility rules applied."""
        try:
            if role != "student":
                raise Exception("Only students can view results")

            user = userModel.getUserBySchoolId(school_id)
            if not user:
                raise Exception("User not found")

            attempts = resultModel.getStudentAttempts(user["id"])
            results = []

            for attempt in attempts:
                summary = ResultsController._build_result_summary(attempt)
                summary.pop("essayPending", None)
                results.append(summary)

            return {
                "success": True,
                "results": results,
            }
        except Exception as e:
            raise e

    @staticmethod
    def getStudentResultDetail(school_id: str, role: str, attempt_id: int):
        """Get one student result detail with visibility rules applied."""
        try:
            if role != "student":
                raise Exception("Only students can view results")

            user = userModel.getUserBySchoolId(school_id)
            if not user:
                raise Exception("User not found")

            attempt = resultModel.getAttemptWithExam(attempt_id)
            if not attempt:
                raise Exception("Attempt not found")

            if int(attempt["student_id"]) != int(user["id"]):
                raise Exception("Attempt does not belong to student")

            result = ResultsController._build_result_summary(attempt)
            allow_view_details = result["allowViewDetails"]

            if attempt["result_visibility"] == "hidden":
                result["score"] = None
                result["correctAnswers"] = None
                result["questions"] = []
            elif not allow_view_details:
                result["questions"] = []
            else:
                mcq_rows = resultModel.getAttemptMcqQuestionRows(attempt_id)
                essay_rows = resultModel.getAttemptEssayQuestionRows(attempt_id)
                questions = []
                mcq_map = {}

                for row in mcq_rows:
                    question_id = row["question_id"]
                    item = mcq_map.get(question_id)
                    if not item:
                        item = {
                            "id": question_id,
                            "type": "mcq",
                            "topic": row["topic"],
                            "question": row["question_text"],
                            "options": [],
                            "studentAnswer": None,
                            "correctAnswer": None,
                            "isCorrect": False,
                            "points": row["question_point"],
                            "_display_order": row["display_order"],
                        }
                        mcq_map[question_id] = item
                        questions.append(item)

                    if row["options_text"] is not None:
                        item["options"].append(row["options_text"])

                    if row["selected_option_id"] == row["options_id"]:
                        item["studentAnswer"] = row["options_text"]

                    if row["is_correct"]:
                        item["correctAnswer"] = row["options_text"]

                for item in questions:
                    item["isCorrect"] = (
                        item["studentAnswer"] is not None
                        and item["studentAnswer"] == item["correctAnswer"]
                    )

                for row in essay_rows:
                    questions.append(
                        {
                            "id": row["question_id"],
                            "type": "essay",
                            "topic": row["topic"],
                            "question": row["question_text"],
                            "studentAnswer": row["answer_text"],
                            "score": row["score"],
                            "isCorrect": False,
                            "_display_order": row["display_order"],
                        }
                    )

                questions.sort(key=lambda item: item.get("_display_order", 0))
                for item in questions:
                    item.pop("_display_order", None)

                result["questions"] = questions

            result.pop("status", None)
            result.pop("essayPending", None)

            return {
                "success": True,
                "result": result,
            }
        except Exception as e:
            raise e
