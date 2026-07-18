from datetime import datetime
from decimal import Decimal
from src.a_db_config.config import get_db_connection


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
        return "full"
    return str(value)


def _score_value(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        value = float(value)
    return int(value) if float(value).is_integer() else float(value)


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
        e.title,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        e.result_visibility,
        COALESCE(s.subject_name, e.subject_id, e.description, 'General') AS subject,
        COUNT(DISTINCT aq.question_id) AS total_questions,
        COALESCE(SUM(CASE WHEN o.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct_answers,
        COALESCE(SUM(CASE WHEN q.question_type = 'essay' AND ea.score IS NULL THEN 1 ELSE 0 END), 0) AS pending_essay_count
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
    LEFT JOIN options o
        ON o.options_id = ma.selected_option_id
    LEFT JOIN essay_answers ea
        ON ea.attempt_id = aq.attempt_id
        AND ea.question_id = aq.question_id
    WHERE a.student_id = %s
      AND a.submitted_at IS NOT NULL
    GROUP BY
        a.attempt_id,
        a.exam_id,
        a.attempt_no,
        a.score,
        a.start_time,
        a.end_time,
        a.submitted_at,
        e.title,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        e.result_visibility,
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
            correct_answers = int(row["correct_answers"] or 0)
            total_questions = int(row["total_questions"] or 0)

            results.append({
                "id": str(row["attempt_id"]),
                "attemptId": row["attempt_id"],
                "examId": row["exam_id"],
                "examTitle": row["title"],
                "subject": row["subject"] or "General",
                "date": _iso(row["submitted_at"] or row["end_time"] or row["start_time"]),
                "duration": _duration_label(row["duration_minutes"]),
                "status": status,
                "score": correct_answers,
                "rawScore": _score_value(row["score"]),
                "correctAnswers": correct_answers,
                "totalQuestions": total_questions,
                "timeTaken": _time_taken(row["start_time"], row["end_time"], row["submitted_at"]),
                "scoreVisible": score_visible,
                "allowViewDetails": allow_view_details,
                "attemptNumber": row["attempt_no"],
                "maxAttempts": row["max_attempt"],
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
        e.title,
        e.description,
        e.duration_minutes,
        e.result_visibility,
        COALESCE(s.subject_name, e.subject_id, e.description, 'General') AS subject,
        COUNT(DISTINCT aq.question_id) AS total_questions,
        COALESCE(SUM(CASE WHEN o.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct_answers,
        COALESCE(SUM(CASE WHEN q.question_type = 'essay' AND ea.score IS NULL THEN 1 ELSE 0 END), 0) AS pending_essay_count
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
    LEFT JOIN options o
        ON o.options_id = ma.selected_option_id
    LEFT JOIN essay_answers ea
        ON ea.attempt_id = aq.attempt_id
        AND ea.question_id = aq.question_id
    WHERE a.student_id = %s
      AND a.attempt_id = %s
      AND a.submitted_at IS NOT NULL
    GROUP BY
        a.attempt_id,
        a.exam_id,
        a.attempt_no,
        a.score,
        a.start_time,
        a.end_time,
        a.submitted_at,
        e.title,
        e.description,
        e.duration_minutes,
        e.result_visibility,
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
        correct_answers = int(row["correct_answers"] or 0)
        total_questions = int(row["total_questions"] or 0)

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
            "score": correct_answers,
            "rawScore": _score_value(row["score"]),
            "correctAnswers": correct_answers,
            "totalQuestions": total_questions,
            "scoreVisible": score_visible,
            "allowViewDetails": allow_view_details,
            "questions": [],
        }

        if allow_view_details:
            result["questions"] = _get_attempt_questions(cursor, row["attempt_id"])

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
        eq.question_point,
        ma.selected_option_id,
        selected.options_text AS student_mcq_answer,
        selected.is_correct AS selected_is_correct,
        ea.answer_text AS essay_answer,
        ea.score AS essay_score
    FROM attempt_question aq
    JOIN attempt a
        ON a.attempt_id = aq.attempt_id
    JOIN question q
        ON q.question_id = aq.question_id
    LEFT JOIN exam_question eq
        ON eq.exam_id = a.exam_id
        AND eq.question_id = q.question_id
    LEFT JOIN mcq_answers ma
        ON ma.attempt_id = aq.attempt_id
        AND ma.question_id = aq.question_id
    LEFT JOIN options selected
        ON selected.options_id = ma.selected_option_id
    LEFT JOIN essay_answers ea
        ON ea.attempt_id = aq.attempt_id
        AND ea.question_id = aq.question_id
    WHERE aq.attempt_id = %s
    ORDER BY aq.display_order ASC, aq.question_id ASC
    """
    options_query = """
    SELECT options_id, options_text, is_correct
    FROM options
    WHERE question_id = %s
    ORDER BY options_id ASC
    """

    cursor.execute(question_query, (attempt_id,))
    rows = cursor.fetchall()
    questions = []

    for row in rows:
        question_type = row["question_type"]
        if question_type == "essay":
            questions.append({
                "id": row["question_id"],
                "type": "essay",
                "topic": row["subject_id"],
                "isCorrect": row["essay_score"] is not None and int(row["essay_score"] or 0) > 0,
                "question": row["question_text"],
                "studentAnswer": row["essay_answer"],
                "correctAnswer": None,
                "points": row["question_point"],
                "score": row["essay_score"],
            })
            continue

        cursor.execute(options_query, (row["question_id"],))
        option_rows = cursor.fetchall()
        options = [option["options_text"] for option in option_rows]
        correct_answer = next(
            (option["options_text"] for option in option_rows if option["is_correct"]),
            None,
        )

        questions.append({
            "id": row["question_id"],
            "type": "mcq",
            "topic": row["subject_id"],
            "isCorrect": bool(row["selected_is_correct"]),
            "question": row["question_text"],
            "options": options,
            "studentAnswer": row["student_mcq_answer"],
            "correctAnswer": correct_answer,
            "points": row["question_point"],
            "score": row["question_point"] if row["selected_is_correct"] else 0,
        })

    return questions
