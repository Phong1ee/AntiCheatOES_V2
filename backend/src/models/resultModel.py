import json
from datetime import datetime
from decimal import Decimal
from src.a_db_config.config import get_db_connection
from src.service.scoring_service import GRADING_SCALE


def _iso(value):
    return value.isoformat() if value else None


def _duration_label(minutes):
    return f"{int(minutes)} min" if minutes else "N/A"


def _time_taken(start_time, end_time, submitted_at):
    finish_time = end_time or submitted_at
    if not start_time or not finish_time:
        return "N/A"

    total_seconds = max(int((finish_time - start_time).total_seconds()), 0)
    minutes, seconds = divmod(total_seconds, 60)
    if minutes <= 0:
        return f"{seconds}s"
    if seconds == 0:
        return f"{minutes} min"
    return f"{minutes} min {seconds}s"


def _visibility(value):
    if value is None:
        # Legacy rows without a visibility value must not expose results by default.
        return "hidden"
    return str(value)


def _score_value(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        value = float(value)
    return int(value) if float(value).is_integer() else float(value)


def _attempt_total_points(snapshot_points, _legacy_exam_total=None):
    """Return the immutable raw denominator from the attempt's actual questions."""
    return _score_value(snapshot_points) or 0


def _status(result_visibility, pending_essay_count):
    visibility = _visibility(result_visibility)
    if visibility == "hidden":
        return "hidden"
    if pending_essay_count > 0:
        return "pending"
    return "published"


def _result_flags(result_visibility, pending_essay_count):
    status = _status(result_visibility, pending_essay_count)
    visibility = _visibility(result_visibility)
    score_visible = status == "published" and visibility in {"score-only", "full"}
    allow_view_details = status == "published" and visibility == "full"
    return status, score_visible, allow_view_details


def _snapshot_options(value):
    if isinstance(value, str):
        return json.loads(value)
    return value or []


def get_student_results(user_id: int):
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT
        a.attempt_id,
        a.exam_id,
        a.attempt_no,
        a.score,
        a.start_time,
        a.end_time,
        a.submitted_at,
        a.status AS attempt_status,
        e.title,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        e.result_visibility,
        e.total_points AS exam_total_points,
        e.passing_score,
        COALESCE(s.subject_name, e.subject_id, e.description, 'General') AS subject,
        COUNT(DISTINCT aq.question_id) AS total_questions,
        COALESCE(SUM(COALESCE(aq.question_point_snapshot, aq.question_point, 0)), 0) AS snapshot_total_points,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(aq.question_type_snapshot, q.question_type)) = 'essay'
                               AND NULLIF(TRIM(COALESCE(ea.answer_text, '')), '') IS NOT NULL
                               AND ea.score IS NULL THEN 1 ELSE 0 END), 0) AS pending_essay_count,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(aq.question_type_snapshot, q.question_type)) <> 'essay'
                               AND selected_option.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct_answers
    FROM attempt a
    JOIN exam e
        ON e.exam_id = a.exam_id
    LEFT JOIN subject s
        ON s.subject_id = e.subject_id
    LEFT JOIN attempt_question aq
        ON aq.attempt_id = a.attempt_id
    LEFT JOIN question q
        ON q.question_id = aq.question_id
    LEFT JOIN mcq_answers ma
        ON ma.attempt_id = aq.attempt_id
        AND ma.question_id = aq.question_id
    LEFT JOIN options selected_option
        ON selected_option.options_id = ma.selected_option_id
    LEFT JOIN essay_answers ea
        ON ea.attempt_id = aq.attempt_id
        AND ea.question_id = aq.question_id
    WHERE a.student_id = %s
      AND a.submitted_at IS NOT NULL
      AND a.status IN ('submitted', 'terminated')
    GROUP BY
        a.attempt_id,
        a.exam_id,
        a.attempt_no,
        a.score,
        a.start_time,
        a.end_time,
        a.submitted_at,
        a.status,
        e.title,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        e.result_visibility,
        e.total_points,
        e.passing_score,
        s.subject_name,
        e.subject_id
    ORDER BY a.submitted_at DESC, a.attempt_id DESC
    """
    try:
        cursor.execute(query, (user_id,))
        rows = cursor.fetchall()
        results = []

        for row in rows:
            pending_essay_count = int(row["pending_essay_count"] or 0)
            status, score_visible, allow_view_details = _result_flags(
                row["result_visibility"],
                pending_essay_count,
            )
            total_questions = int(row["total_questions"] or 0)
            correct_answers = int(row["correct_answers"] or 0) if allow_view_details else None
            total_points = _attempt_total_points(row["snapshot_total_points"])

            visible_score = _score_value(row["score"]) if score_visible else None
            results.append({
                "id": str(row["attempt_id"]),
                "attemptId": row["attempt_id"],
                "examId": row["exam_id"],
                "examTitle": row["title"],
                "subject": row["subject"] or "General",
                "date": _iso(row["submitted_at"] or row["end_time"] or row["start_time"]),
                "duration": _duration_label(row["duration_minutes"]),
                "status": status,
                "score": visible_score,
                "rawScore": None,
                "rawEarnedScore": None,
                "rawPossibleScore": total_points,
                "totalPoints": total_points,
                "gradingScale": _score_value(GRADING_SCALE),
                "passingScore": _score_value(row["passing_score"]),
                "passed": (
                    visible_score >= _score_value(row["passing_score"])
                    if visible_score is not None and row["passing_score"] is not None
                    else None
                ),
                "correctAnswers": correct_answers if allow_view_details else None,
                "totalQuestions": total_questions,
                "timeTaken": _time_taken(row["start_time"], row["end_time"], row["submitted_at"]),
                "scoreVisible": score_visible,
                "allowViewDetails": allow_view_details,
                "attemptNumber": row["attempt_no"],
                "maxAttempts": row["max_attempt"],
                "attemptStatus": row["attempt_status"],
                "terminated": row["attempt_status"] == "terminated",
            })

        return results
    finally:
        cursor.close()
        cnx.close()


def get_student_result_detail(user_id: int, attempt_id: int):
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    base_query = """
    SELECT
        a.attempt_id,
        a.exam_id,
        a.attempt_no,
        a.score,
        a.start_time,
        a.end_time,
        a.submitted_at,
        a.status AS attempt_status,
        e.title,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        e.result_visibility,
        e.total_points AS exam_total_points,
        e.passing_score,
        COALESCE(s.subject_name, e.subject_id, e.description, 'General') AS subject,
        COUNT(DISTINCT aq.question_id) AS total_questions,
        COALESCE(SUM(COALESCE(aq.question_point_snapshot, aq.question_point, 0)), 0) AS snapshot_total_points,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(aq.question_type_snapshot, q.question_type)) = 'essay'
                               AND NULLIF(TRIM(COALESCE(ea.answer_text, '')), '') IS NOT NULL
                               AND ea.score IS NULL THEN 1 ELSE 0 END), 0) AS pending_essay_count
    FROM attempt a
    JOIN exam e
        ON e.exam_id = a.exam_id
    LEFT JOIN subject s
        ON s.subject_id = e.subject_id
    LEFT JOIN attempt_question aq
        ON aq.attempt_id = a.attempt_id
    LEFT JOIN question q
        ON q.question_id = aq.question_id
    LEFT JOIN mcq_answers ma
        ON ma.attempt_id = aq.attempt_id
        AND ma.question_id = aq.question_id
    LEFT JOIN essay_answers ea
        ON ea.attempt_id = aq.attempt_id
        AND ea.question_id = aq.question_id
    WHERE a.student_id = %s
      AND a.attempt_id = %s
      AND a.submitted_at IS NOT NULL
      AND a.status IN ('submitted', 'terminated')
    GROUP BY
        a.attempt_id,
        a.exam_id,
        a.attempt_no,
        a.score,
        a.start_time,
        a.end_time,
        a.submitted_at,
        a.status,
        e.title,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        e.result_visibility,
        e.total_points,
        e.passing_score,
        s.subject_name,
        e.subject_id
    """
    try:
        cursor.execute(base_query, (user_id, attempt_id))
        row = cursor.fetchone()
        if not row:
            return None

        pending_essay_count = int(row["pending_essay_count"] or 0)
        status, score_visible, allow_view_details = _result_flags(
            row["result_visibility"],
            pending_essay_count,
        )
        total_questions = int(row["total_questions"] or 0)
        total_points = _attempt_total_points(row["snapshot_total_points"])

        question_details = _get_attempt_questions(cursor, row["attempt_id"]) if allow_view_details else []
        raw_earned = sum(
            Decimal(str(question["awardedPoints"] or 0))
            for question in question_details
            if question["awardedPoints"] is not None
        ) if allow_view_details else None
        visible_score = _score_value(row["score"]) if score_visible else None
        result = {
            "id": str(row["attempt_id"]),
            "attemptId": row["attempt_id"],
            "examId": row["exam_id"],
            "examTitle": row["title"],
            "subject": row["subject"] or "General",
            "date": _iso(row["submitted_at"] or row["end_time"] or row["start_time"]),
            "duration": _duration_label(row["duration_minutes"]),
            "timeTaken": _time_taken(row["start_time"], row["end_time"], row["submitted_at"]),
            "status": status,
            "score": visible_score,
            "rawScore": _score_value(raw_earned) if raw_earned is not None and score_visible else None,
            "rawEarnedScore": _score_value(raw_earned) if raw_earned is not None and score_visible else None,
            "rawPossibleScore": total_points,
            "totalPoints": total_points,
            "gradingScale": _score_value(GRADING_SCALE),
            "passingScore": _score_value(row["passing_score"]),
            "passed": (
                visible_score >= _score_value(row["passing_score"])
                if visible_score is not None and row["passing_score"] is not None
                else None
            ),
            "correctAnswers": None,
            "totalQuestions": total_questions,
            "scoreVisible": score_visible,
            "allowViewDetails": allow_view_details,
            "attemptNumber": row["attempt_no"],
            "maxAttempts": row["max_attempt"],
            "attemptStatus": row["attempt_status"],
            "terminated": row["attempt_status"] == "terminated",
            "questions": [],
        }

        if allow_view_details:
            result["questions"] = question_details
            result["correctAnswers"] = sum(1 for question in result["questions"] if question["isCorrect"])

        return result
    finally:
        cursor.close()
        cnx.close()


def _get_attempt_questions(cursor, attempt_id: int):
    question_query = """
    SELECT
        aq.question_id,
        aq.display_order,
        q.question_text,
        q.question_type,
        q.subject_id,
        aq.question_point,
        aq.question_text_snapshot,
        aq.question_type_snapshot,
        aq.question_point_snapshot,
        aq.options_snapshot,
        ma.selected_option_id,
        ea.answer_text AS essay_answer,
        ea.score AS essay_score
    FROM attempt_question aq
    JOIN attempt a
        ON a.attempt_id = aq.attempt_id
    JOIN question q
        ON q.question_id = aq.question_id
    LEFT JOIN mcq_answers ma
        ON ma.attempt_id = aq.attempt_id
        AND ma.question_id = aq.question_id
    LEFT JOIN essay_answers ea
        ON ea.attempt_id = aq.attempt_id
        AND ea.question_id = aq.question_id
    WHERE aq.attempt_id = %s
    ORDER BY aq.display_order ASC, aq.question_id ASC
    """
    cursor.execute(question_query, (attempt_id,))
    rows = cursor.fetchall()
    live_options_by_question = {}
    live_option_question_ids = [
        row["question_id"] for row in rows if row["options_snapshot"] is None
    ]
    if live_option_question_ids:
        placeholders = ", ".join(["%s"] * len(live_option_question_ids))
        cursor.execute(
            f"""
            SELECT question_id, options_id, options_text, is_correct
            FROM options
            WHERE question_id IN ({placeholders})
            ORDER BY question_id ASC, options_id ASC
            """,
            tuple(live_option_question_ids),
        )
        for option in cursor.fetchall():
            live_options_by_question.setdefault(option["question_id"], []).append(option)

    questions = []

    for row in rows:
        question_type = row["question_type_snapshot"] or row["question_type"]
        question_text = row["question_text_snapshot"] or row["question_text"]
        points = row["question_point_snapshot"]
        if points is None:
            points = row["question_point"]
        max_points = _score_value(points) or 0
        if str(question_type).lower() == "essay":
            essay_answer = row["essay_answer"]
            essay_is_blank = not str(essay_answer or "").strip()
            if essay_is_blank:
                awarded_points = 0
                grading_status = "blank"
            elif row["essay_score"] is None:
                awarded_points = None
                grading_status = "pending"
            else:
                awarded_points = _score_value(row["essay_score"])
                grading_status = "graded"
            # Keep legacy points/score aligned with maxPoints/awardedPoints.
            questions.append({
                "id": row["question_id"],
                "type": "essay",
                "topic": row["subject_id"],
                "isCorrect": row["essay_score"] is not None and int(row["essay_score"] or 0) > 0,
                "question": question_text,
                "studentAnswer": essay_answer,
                "correctAnswer": None,
                "maxPoints": max_points,
                "awardedPoints": awarded_points,
                "gradingStatus": grading_status,
                "points": max_points,
                "score": awarded_points,
            })
            continue

        snapshot = row["options_snapshot"]
        if snapshot is not None:
            option_rows = _snapshot_options(snapshot)
            options = [option["text"] for option in option_rows]
            selected = next(
                (option for option in option_rows if int(option["id"]) == int(row["selected_option_id"])),
                None,
            ) if row["selected_option_id"] is not None else None
            correct_answers = [option["text"] for option in option_rows if option.get("isCorrect")]
            student_answer = selected["text"] if selected else None
            correct_answer = correct_answers[0] if correct_answers else None
            selected_is_correct = bool(selected and selected.get("isCorrect"))
        else:
            option_rows = live_options_by_question.get(row["question_id"], [])
            options = [option["options_text"] for option in option_rows]
            correct_answers = [option["options_text"] for option in option_rows if option["is_correct"]]
            correct_answer = correct_answers[0] if correct_answers else None
            selected = next(
                (option for option in option_rows if row["selected_option_id"] is not None and int(option["options_id"]) == int(row["selected_option_id"])),
                None,
            )
            student_answer = selected["options_text"] if selected else None
            selected_is_correct = bool(selected and selected["is_correct"])

        awarded_points = max_points if selected_is_correct else 0
        # Keep legacy points/score aligned with maxPoints/awardedPoints.
        questions.append({
            "id": row["question_id"],
            "type": "mcq",
            "topic": row["subject_id"],
            "isCorrect": selected_is_correct,
            "question": question_text,
            "options": options,
            "studentAnswer": student_answer,
            "correctAnswer": correct_answer,
            "correctAnswers": correct_answers,
            "maxPoints": max_points,
            "awardedPoints": awarded_points,
            "gradingStatus": "graded",
            "points": max_points,
            "score": awarded_points,
        })

    return questions
