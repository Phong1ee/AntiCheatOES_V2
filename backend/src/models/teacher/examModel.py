import json
from datetime import timedelta
from decimal import Decimal

from src.a_db_config.config import get_db_connection
from src.service.exam_pool_service import seeded_random, select_unique_candidates
from src.service.scoring_service import GRADING_SCALE, normalize_score, validate_max_score


VIOLATION_EVENT_TYPES = {
    "TAB_HIDDEN", "WINDOW_BLUR", "FULLSCREEN_EXIT", "COPY_ATTEMPT",
    "PASTE_ATTEMPT", "CUT_ATTEMPT", "PRINT_ATTEMPT", "BLOCKED_SHORTCUT",
    "PAGE_REFRESH", "CAMERA_PERMISSION_DENIED", "CAMERA_TRACK_MUTED",
    "CAMERA_TRACK_ENDED", "MIC_PERMISSION_DENIED", "MIC_TRACK_MUTED",
    "MIC_TRACK_ENDED", "NO_FACE_DETECTED", "MULTIPLE_FACES_DETECTED",
    "PHONE_DETECTED", "SPEECH_ACTIVITY_DETECTED",
}

ALLOWED_CLIENT_EVENT_TYPES = VIOLATION_EVENT_TYPES
ALLOWED_EVENT_SOURCES = {"browser", "camera", "microphone"}


def get_database_now():
    """Return MySQL's UTC DATETIME clock for Student attempt decisions."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    try:
        cursor.execute("SELECT NOW()")
        return cursor.fetchone()[0]
    finally:
        cursor.close()
        cnx.close()


def insertQuestion(question_text: str, question_type: str):
    """Insert a new question into the database."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    INSERT INTO question (question_text, question_type)
    VALUES (%s, %s, %s)
    """
    try:
        cursor.execute(query, (question_text, question_type))
        cnx.commit()
        return cursor.lastrowid
    except Exception as e:
        cnx.rollback()
        raise e
    finally:
        cursor.close()
        cnx.close()

def getStudentExams(school_id: str):
    """Get all exams assigned to a specific student."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT
        e.exam_id,
        e.exam_id AS id,
        e.title,
        CASE WHEN e.examcode IS NOT NULL AND TRIM(e.examcode) <> '' THEN TRUE ELSE FALSE END AS requires_exam_code,
        CASE
            WHEN e.examcode IS NOT NULL
             AND TRIM(e.examcode) <> ''
             AND e.start_time IS NOT NULL
             AND NOW() >= DATE_SUB(e.start_time, INTERVAL 5 MINUTE)
             AND (e.end_time IS NULL OR NOW() <= e.end_time)
            THEN e.examcode
            ELSE NULL
        END AS released_examcode,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        COUNT(a.attempt_id) AS attempts_used,
        e.start_time,
        e.end_time,
        e.result_visibility,
        COALESCE(es.anti_cheat_enabled, FALSE) AS anti_cheat_enabled,
        COALESCE(es.violation_limit, 5) AS violation_limit,
        COALESCE(es.anti_cheat_enabled, FALSE) AS requires_fullscreen
        ,MAX(CASE
            WHEN a.status = 'in_progress'
             AND a.submitted_at IS NULL
             AND a.end_time IS NULL
            THEN a.attempt_id
            ELSE NULL
        END) AS open_attempt_id
        ,MAX(CASE
            WHEN a.status = 'in_progress'
             AND a.submitted_at IS NULL
             AND a.end_time IS NULL
            THEN a.start_time
            ELSE NULL
        END) AS open_attempt_start_time
    FROM student_exam se
    JOIN user u
        ON u.school_id = se.student_id
    JOIN exam e
        ON e.exam_id = se.exam_id
    LEFT JOIN exam_setting es
        ON es.exam_id = e.exam_id
    LEFT JOIN attempt a
        ON a.exam_id = e.exam_id
        AND a.student_id = u.school_id
    WHERE se.student_id = %s
      AND e.status = 'published'
    GROUP BY
        e.exam_id,
        e.title,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        e.start_time,
        e.end_time,
        e.result_visibility,
        es.anti_cheat_enabled,
        es.violation_limit
    ORDER BY e.start_time ASC, e.exam_id ASC
    """
    try:
        cursor.execute(query, (school_id,))
        exams = cursor.fetchall()
        now_time = get_database_now()

        for exam in exams:
            attempts_used = int(exam["attempts_used"] or 0)
            max_attempt = exam["max_attempt"]

            open_attempt_id = exam.pop("open_attempt_id", None)
            open_attempt_start_time = exam.pop("open_attempt_start_time", None)
            has_open_attempt = open_attempt_id is not None
            if has_open_attempt and open_attempt_start_time:
                duration_expiry = open_attempt_start_time + timedelta(minutes=int(exam["duration_minutes"] or 0))
                expires_at = min(duration_expiry, exam["end_time"]) if exam["end_time"] else duration_expiry
                has_open_attempt = expires_at > now_time

            if max_attempt is None or int(max_attempt) <= 0:
                remaining_attempts = None
            else:
                remaining_attempts = max(int(max_attempt) - attempts_used, 0)

            if exam["start_time"] and now_time < exam["start_time"]:
                status = "upcoming"
            elif exam["end_time"] and now_time > exam["end_time"]:
                status = "closed"
            elif max_attempt is not None and int(max_attempt) > 0 and attempts_used >= int(max_attempt) and not has_open_attempt:
                status = "completed"
            else:
                status = "open"

            exam["attempts_used"] = attempts_used
            exam["remaining_attempts"] = remaining_attempts
            exam["status"] = status
            exam["requires_fullscreen"] = bool(exam.get("requires_fullscreen"))
            exam["has_open_attempt"] = has_open_attempt
            exam["open_attempt_id"] = int(open_attempt_id) if has_open_attempt else None
            exam["can_resume"] = has_open_attempt and status != "closed"

        return exams
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getAssignedExamById(school_id: str, exam_id: int):
    """Get a single assigned exam detail for a student."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT
        e.exam_id,
        e.exam_id AS id,
        e.title,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        COUNT(a.attempt_id) AS attempts_used,
        e.start_time,
        e.end_time,
        e.result_visibility,
        COALESCE(es.anti_cheat_enabled, FALSE) AS anti_cheat_enabled,
        COALESCE(es.violation_limit, 5) AS violation_limit
    FROM student_exam se
    JOIN user u
        ON u.school_id = se.student_id
    JOIN exam e
        ON e.exam_id = se.exam_id
    LEFT JOIN exam_setting es
        ON es.exam_id = e.exam_id
    LEFT JOIN attempt a
        ON a.exam_id = e.exam_id
        AND a.student_id = u.school_id
    WHERE se.student_id = %s
      AND e.exam_id = %s
    GROUP BY
        e.exam_id,
        e.title,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        e.start_time,
        e.end_time,
        e.result_visibility,
        es.anti_cheat_enabled,
        es.violation_limit
    """
    try:
        cursor.execute(query, (school_id, exam_id))
        exam = cursor.fetchone()
        if not exam:
            return None

        exam["attempts_used"] = int(exam["attempts_used"] or 0)
        return exam
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getExamQuestions(exam_id: int, attempt_id: int | None = None):
    """Get exam questions and student-safe options without correct answers."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    question_query = """
    SELECT
        q.question_id,
        q.question_text,
        q.question_type,
        aq.question_point,
        aq.question_text_snapshot,
        aq.question_type_snapshot,
        aq.question_point_snapshot,
        aq.options_snapshot,
        ma.selected_option_id,
        ea.answer_text
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
    WHERE a.exam_id = %s
      AND aq.attempt_id = %s
    ORDER BY aq.display_order ASC
    """
    fixed_question_query = """
    SELECT
        q.question_id,
        q.question_text,
        q.question_type,
        eq.question_point
    FROM exam_question eq
    JOIN question q ON q.question_id = eq.question_id
    WHERE eq.exam_id = %s
    ORDER BY q.question_id ASC
    """
    options_query = """
    SELECT
        options_id,
        options_text
    FROM options
    WHERE question_id = %s
    ORDER BY options_id ASC
    """
    try:
        if attempt_id is not None:
            cursor.execute(question_query, (exam_id, attempt_id))
        else:
            cursor.execute(fixed_question_query, (exam_id,))
        question_rows = cursor.fetchall()
        questions = []

        for row in question_rows:
            stored_type = row.get("question_type_snapshot") or row["question_type"]
            question_type = (
                "multiple-choice" if stored_type == "MCQ" else stored_type
            )
            options = []

            if question_type in {"multiple-choice", "true-false"}:
                snapshot = row.get("options_snapshot") if attempt_id is not None else None
                if isinstance(snapshot, str):
                    snapshot = json.loads(snapshot)
                if snapshot is not None:
                    options = [
                        {"id": option["id"], "text": option["text"]}
                        for option in snapshot
                    ]
                else:
                    cursor.execute(options_query, (row["question_id"],))
                    option_rows = cursor.fetchall()
                    options = [
                        {"id": option["options_id"], "text": option["options_text"]}
                        for option in option_rows
                    ]

            question = {
                "id": row["question_id"],
                "question_id": row["question_id"],
                "text": row.get("question_text_snapshot") or row["question_text"],
                "type": question_type,
                "points": row["question_point_snapshot"]
                if row.get("question_point_snapshot") is not None
                else row["question_point"],
                "options": options
            }
            if attempt_id is not None:
                if row.get("selected_option_id") is not None:
                    question["savedAnswer"] = {"selectedOptionId": row["selected_option_id"]}
                elif row.get("answer_text") is not None:
                    question["savedAnswer"] = {"answerText": row["answer_text"]}
            questions.append(question)

        return questions
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getExamById(exam_id: int):
    """Get exam basic data by exam_id."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT exam_id, examcode, max_attempt, duration_minutes, start_time, end_time,
           question_selection_mode, total_points
    FROM exam
    WHERE exam_id = %s
    """
    try:
        cursor.execute(query, (exam_id,))
        return cursor.fetchone()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def validateExamQuestionPoints(exam_id: int):
    """Reject starting an exam without a positive raw-score denominator."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT question_selection_mode FROM exam WHERE exam_id = %s",
            (exam_id,),
        )
        exam = cursor.fetchone()
        if not exam:
            raise Exception("Exam not found")
        if str(exam["question_selection_mode"] or "manual") == "pool":
            cursor.execute(
                """
                SELECT COUNT(*) AS rule_count,
                       COALESCE(SUM(r.draw_count), 0) AS draw_count,
                       COALESCE(SUM(r.draw_count * r.max_score_per_question), 0) AS possible_score
                FROM exam_pool_config c
                LEFT JOIN exam_pool_rule r ON r.pool_config_id = c.pool_config_id
                WHERE c.exam_id = %s
                """,
                (exam_id,),
            )
            pool = cursor.fetchone()
            if (
                not pool
                or int(pool["rule_count"] or 0) == 0
                or int(pool["draw_count"] or 0) == 0
                or Decimal(str(pool["possible_score"] or 0)) <= 0
            ):
                raise Exception("Exam pool configuration is empty")
            return
        cursor.execute(
            """
            SELECT COUNT(*) AS question_count,
                   COALESCE(SUM(question_point), 0) AS possible_score,
                   COALESCE(SUM(question_point <= 0), 0) AS invalid_scores
            FROM exam_question
            WHERE exam_id = %s
            """,
            (exam_id,),
        )
        points = cursor.fetchone()
        if int(points["question_count"] or 0) == 0:
            raise Exception("Exam has no questions")
        if Decimal(str(points["possible_score"] or 0)) <= 0 or int(points["invalid_scores"] or 0) > 0:
            raise Exception("Every exam question requires a positive max score")
    finally:
        cursor.close()
        cnx.close()


def isStudentAssignedToExam(school_id: str, exam_id: int):
    """Check whether a student is assigned to an exam."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    SELECT 1
    FROM student_exam
    WHERE student_id = %s AND exam_id = %s
    LIMIT 1
    """
    try:
        cursor.execute(query, (school_id, exam_id))
        return cursor.fetchone() is not None
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def countStudentAttempts(exam_id: int, student_id: str):
    """Count attempts for a student on a specific exam."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    SELECT COUNT(attempt_id)
    FROM attempt
    WHERE exam_id = %s AND student_id = %s
    """
    try:
        cursor.execute(query, (exam_id, student_id))
        result = cursor.fetchone()
        return int(result[0] or 0)
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getOpenAttempt(exam_id: int, student_id: str):
    """Get an existing open attempt for the same exam and student."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT attempt_id, attempt_no, exam_id, student_id, start_time, status, last_saved_at
    FROM attempt
    WHERE exam_id = %s
      AND student_id = %s
      AND status = 'in_progress'
      AND submitted_at IS NULL
      AND end_time IS NULL
    ORDER BY attempt_id DESC
    LIMIT 1
    """
    try:
        cursor.execute(query, (exam_id, student_id))
        return cursor.fetchone()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def createAttempt(exam_id: int, student_id: str, attempt_no: int):
    """Create an attempt and immutable question/point snapshot in one transaction."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    insert_attempt = """
    INSERT INTO attempt (
        exam_id,
        student_id,
        attempt_no,
        score,
        start_time,
        end_time,
        submitted_at,
        status
    )
    VALUES (%s, %s, %s, NULL, NOW(), NULL, NULL, 'in_progress')
    """
    try:
        cnx.start_transaction()
        cursor.execute(
            """
            SELECT attempt_id
            FROM attempt
            WHERE exam_id = %s AND student_id = %s
              AND status = 'in_progress'
              AND submitted_at IS NULL AND end_time IS NULL
            ORDER BY attempt_id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (exam_id, student_id),
        )
        existing = cursor.fetchone()
        if existing:
            cnx.commit()
            return int(existing[0])

        cursor.execute(insert_attempt, (exam_id, student_id, attempt_no))
        attempt_id = cursor.lastrowid
        cursor.execute(
            "SELECT question_selection_mode FROM exam WHERE exam_id = %s FOR UPDATE",
            (exam_id,),
        )
        exam_row = cursor.fetchone()
        if not exam_row:
            raise Exception("Exam not found")
        mode = str(exam_row[0] or "manual")
        cursor.execute(
            "SELECT shuffle_question, shuffle_answer_options FROM exam_setting WHERE exam_id = %s",
            (exam_id,),
        )
        setting_row = cursor.fetchone()
        shuffle_questions = bool(setting_row and setting_row[0])
        shuffle_options = bool(setting_row and setting_row[1])
        selected_ids: list[int]
        point_map: dict[int, Decimal]
        if mode == "pool":
            cursor.execute(
                """
                SELECT pool_config_id, version
                FROM exam_pool_config
                WHERE exam_id = %s
                FOR UPDATE
                """,
                (exam_id,),
            )
            config = cursor.fetchone()
            if not config:
                raise Exception("Pool configuration not found")
            cursor.execute(
                """
                SELECT rule_id, draw_count, max_score_per_question
                FROM exam_pool_rule
                WHERE pool_config_id = %s
                ORDER BY rule_id
                """,
                (config[0],),
            )
            rule_rows = cursor.fetchall()
            candidate_map: dict[int, list[int]] = {}
            draw_counts: dict[int, int] = {}
            max_scores: dict[int, Decimal] = {}
            for rule_row in rule_rows:
                rule_id, draw_count = rule_row[:2]
                max_score_per_question = rule_row[2] if len(rule_row) > 2 else Decimal("1.00")
                cursor.execute(
                    """
                    SELECT question_id
                    FROM exam_pool_question
                    WHERE rule_id = %s
                    ORDER BY question_id
                    """,
                    (rule_id,),
                )
                candidate_map[int(rule_id)] = [int(row[0]) for row in cursor.fetchall()]
                draw_counts[int(rule_id)] = int(draw_count)
                max_scores[int(rule_id)] = validate_max_score(max_score_per_question)
            selected = select_unique_candidates(
                candidate_map,
                draw_counts,
                seeded_random(exam_id, student_id, attempt_no, int(config[1])),
            )
            selected_ids = [
                question_id
                for rule_id in sorted(selected)
                for question_id in selected[rule_id]
            ]
            if shuffle_questions:
                seeded_random(
                    "question-order", exam_id, student_id, attempt_no, int(config[1])
                ).shuffle(selected_ids)
            point_map = {
                question_id: max_scores[rule_id]
                for rule_id in sorted(selected)
                for question_id in selected[rule_id]
            }
        else:
            cursor.execute(
                "SELECT version FROM exam_pool_config WHERE exam_id = %s",
                (exam_id,),
            )
            fixed_config = cursor.fetchone()
            selection_version = int(fixed_config[0]) if fixed_config else 0
            cursor.execute(
                """
                SELECT question_id, question_point
                FROM exam_question
                WHERE exam_id = %s
                ORDER BY question_id
                """,
                (exam_id,),
            )
            fixed_rows = cursor.fetchall()
            if not fixed_rows:
                raise Exception("Exam has no questions")
            selected_ids = [int(row[0]) for row in fixed_rows]
            point_map = {
                int(question_id): validate_max_score(question_point)
                for question_id, question_point in fixed_rows
            }
            if shuffle_questions:
                seeded_random(
                    "question-order", exam_id, student_id, attempt_no, selection_version
                ).shuffle(selected_ids)

        question_snapshot_map: dict[int, tuple[str, str]] = {}
        options_snapshot_map: dict[int, list[dict[str, object]]] = {}
        for question_id in selected_ids:
            cursor.execute(
                "SELECT question_text, question_type FROM question WHERE question_id = %s",
                (question_id,),
            )
            question_row = cursor.fetchone()
            if not question_row:
                raise Exception(f"Question {question_id} not found")
            question_snapshot_map[question_id] = (question_row[0], question_row[1])
            cursor.execute(
                "SELECT options_id, options_text, is_correct FROM options WHERE question_id = %s ORDER BY options_id ASC",
                (question_id,),
            )
            option_snapshot = [
                {
                    "id": int(option_id),
                    "text": option_text,
                    "isCorrect": bool(is_correct),
                    "displayOrder": index,
                }
                for index, (option_id, option_text, is_correct) in enumerate(cursor.fetchall(), start=1)
            ]
            if shuffle_options:
                seeded_random(
                    "option-order",
                    exam_id,
                    student_id,
                    attempt_no,
                    question_id,
                    selection_version if mode != "pool" else int(config[1]),
                ).shuffle(option_snapshot)
                for index, option in enumerate(option_snapshot, start=1):
                    option["displayOrder"] = index
            options_snapshot_map[question_id] = option_snapshot
        cursor.executemany(
            """
            INSERT INTO attempt_question
                (attempt_id, question_id, display_order, question_point,
                 question_text_snapshot, question_type_snapshot,
                 question_point_snapshot, options_snapshot)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    attempt_id,
                    question_id,
                    index,
                    point_map[question_id],
                    question_snapshot_map[question_id][0],
                    question_snapshot_map[question_id][1],
                    point_map[question_id],
                    json.dumps(options_snapshot_map[question_id]),
                )
                for index, question_id in enumerate(selected_ids, start=1)
            ],
        )
        cnx.commit()
        return attempt_id
    except Exception as e:
        cnx.rollback()
        if getattr(e, "errno", None) == 1062:
            cursor.execute(
                """
                SELECT attempt_id
                FROM attempt
                WHERE exam_id = %s AND student_id = %s AND attempt_no = %s
                LIMIT 1
                """,
                (exam_id, student_id, attempt_no),
            )
            concurrent_attempt = cursor.fetchone()
            if concurrent_attempt:
                return int(concurrent_attempt[0])
        raise e
    finally:
        cursor.close()
        cnx.close()


def getAttemptById(attempt_id: int):
    """Get attempt by id."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT attempt_id, exam_id, student_id, attempt_no, score, start_time, end_time,
           submitted_at, status, last_saved_at, violation_count, last_violation_at
    FROM attempt
    WHERE attempt_id = %s
    """
    try:
        cursor.execute(query, (attempt_id,))
        return cursor.fetchone()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getExamSettings(exam_id: int):
    """Return only the Student-flow settings, using safe defaults when absent."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT auto_submit_on_expire, tab_switch_thresh, copy_paste_thresh,
                   force_fullscreen_thresh, sequential_navigation,
                   anti_cheat_enabled, violation_limit
            FROM exam_setting WHERE exam_id = %s
            """,
            (exam_id,),
        )
        return cursor.fetchone() or {
            "auto_submit_on_expire": True,
            "tab_switch_thresh": 0,
            "copy_paste_thresh": 0,
            "force_fullscreen_thresh": 0,
            "sequential_navigation": False,
            "anti_cheat_enabled": False,
            "violation_limit": 5,
        }
    finally:
        cursor.close()
        cnx.close()


def _decode_snapshot_options(value):
    if isinstance(value, str):
        return json.loads(value)
    return value or []


def _load_attempt_questions(cursor, attempt_id: int, exam_id: int):
    cursor.execute(
        """
        SELECT aq.question_id, aq.display_order, aq.question_point, aq.question_type_snapshot,
               aq.question_point_snapshot, aq.options_snapshot, q.question_type
        FROM attempt_question aq
        JOIN attempt a ON a.attempt_id = aq.attempt_id
        JOIN question q ON q.question_id = aq.question_id
        WHERE aq.attempt_id = %s AND a.exam_id = %s
        FOR UPDATE
        """,
        (attempt_id, exam_id),
    )
    return {row["question_id"]: row for row in cursor.fetchall()}


def _question_type(question: dict) -> str:
    return question.get("question_type_snapshot") or question["question_type"]


def _valid_snapshot_option(cursor, question: dict, option_id: int) -> dict | None:
    snapshot = question.get("options_snapshot")
    if snapshot is not None:
        for option in _decode_snapshot_options(snapshot):
            if int(option["id"]) == int(option_id):
                return option
        return None
    cursor.execute(
        "SELECT options_id AS id, is_correct AS isCorrect FROM options WHERE question_id = %s AND options_id = %s",
        (question["question_id"], option_id),
    )
    return cursor.fetchone()


def _upsert_answer(cursor, attempt_id: int, question: dict, answer: dict):
    question_type = _question_type(question)
    selected_option_id = answer.get("selectedOptionId")
    answer_text = answer.get("answerText")
    if question_type == "essay":
        if selected_option_id is not None:
            raise Exception("Essay questions do not accept selectedOptionId")
        normalized_answer = "" if answer_text is None or not str(answer_text).strip() else str(answer_text)
        score = 0 if normalized_answer == "" else None
        cursor.execute(
            """
            INSERT INTO essay_answers (attempt_id, question_id, answer_text, score)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), score = VALUES(score)
            """,
            (attempt_id, question["question_id"], normalized_answer, score),
        )
        return

    if selected_option_id is None:
        raise Exception("Answer is required")
    if answer_text is not None:
        raise Exception("MCQ questions do not accept answerText")
    option = _valid_snapshot_option(cursor, question, int(selected_option_id))
    if not option:
        raise Exception("Selected option does not belong to the attempt snapshot")
    cursor.execute(
        """
        INSERT INTO mcq_answers (attempt_id, question_id, selected_option_id)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE selected_option_id = VALUES(selected_option_id)
        """,
        (attempt_id, question["question_id"], int(selected_option_id)),
    )


def _answered_question_ids(cursor, attempt_id: int) -> set[int]:
    cursor.execute(
        "SELECT question_id FROM mcq_answers WHERE attempt_id = %s AND selected_option_id IS NOT NULL",
        (attempt_id,),
    )
    answered = {int(row["question_id"]) for row in cursor.fetchall()}
    cursor.execute(
        """
        SELECT question_id FROM essay_answers
        WHERE attempt_id = %s
          AND TRIM(REPLACE(REPLACE(REPLACE(COALESCE(answer_text, ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), '')) <> ''
        """,
        (attempt_id,),
    )
    answered.update(int(row["question_id"]) for row in cursor.fetchall())
    return answered


def _payload_answers_question(question: dict, answer: dict) -> bool:
    if str(_question_type(question)).lower() == "essay":
        return bool(str(answer.get("answerText") or "").strip())
    return answer.get("selectedOptionId") is not None


def _ordered_attempt_questions(questions: dict[int, dict]) -> list[dict]:
    return sorted(questions.values(), key=lambda question: int(question.get("display_order") or 0))


def _validate_sequential_save(questions: dict[int, dict], answered_ids: set[int], question_id: int) -> None:
    ordered = _ordered_attempt_questions(questions)
    current = next((question for question in ordered if question["question_id"] not in answered_ids), None)
    target = questions[question_id]
    if current and target["display_order"] > current["display_order"] and question_id not in answered_ids:
        raise Exception("Complete the current question before moving to the next question")


def _validate_sequential_submit(questions: dict[int, dict], persisted_answered_ids: set[int], answers: list) -> None:
    answered_ids = set(persisted_answered_ids)
    for answer in answers:
        question_id = int(answer["questionId"])
        question = questions.get(question_id)
        if not question:
            raise Exception("Question does not belong to this attempt")
        if _payload_answers_question(question, answer):
            answered_ids.add(question_id)
        else:
            answered_ids.discard(question_id)
    ordered = _ordered_attempt_questions(questions)
    current = next((question for question in ordered if question["question_id"] not in answered_ids), None)
    if current and any(question["question_id"] in answered_ids for question in ordered if question["display_order"] > current["display_order"]):
        raise Exception("Complete the current question before moving to the next question")


def _finalize_essay_answers(cursor, attempt_id: int, questions: dict[int, dict]) -> None:
    """Ensure every Essay snapshot has a final row and only meaningful answers remain pending."""
    for question in questions.values():
        if str(_question_type(question)).lower() != "essay":
            continue
        cursor.execute(
            "SELECT answer_text, score FROM essay_answers WHERE attempt_id = %s AND question_id = %s FOR UPDATE",
            (attempt_id, question["question_id"]),
        )
        existing = cursor.fetchone()
        # A finalized attempt may be revisited after Teacher grading. Never erase that grade.
        if existing and existing.get("score") is not None:
            if not str(existing.get("answer_text") or "").strip() and existing.get("answer_text") != "":
                cursor.execute(
                    "UPDATE essay_answers SET answer_text = %s WHERE attempt_id = %s AND question_id = %s",
                    ("", attempt_id, question["question_id"]),
                )
            continue
        normalized_answer = (
            ""
            if not existing or existing.get("answer_text") is None or not str(existing["answer_text"]).strip()
            else str(existing["answer_text"])
        )
        score = 0 if normalized_answer == "" else None
        cursor.execute(
            """
            INSERT INTO essay_answers (attempt_id, question_id, answer_text, score)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), score = VALUES(score)
            """,
            (attempt_id, question["question_id"], normalized_answer, score),
        )


def _essay_pending(cursor, attempt_id: int) -> bool:
    cursor.execute(
        """
        SELECT COUNT(*) AS pending
        FROM essay_answers
        WHERE attempt_id = %s
          AND score IS NULL
          AND TRIM(
              REPLACE(
                  REPLACE(
                      REPLACE(COALESCE(answer_text, ''), CHAR(9), ''),
                      CHAR(10), ''
                  ),
                  CHAR(13), ''
              )
          ) <> ''
        """,
        (attempt_id,),
    )
    return bool(cursor.fetchone()["pending"])


def _attempt_raw_scores(cursor, attempt_id: int, questions: dict[int, dict]) -> tuple[Decimal, Decimal]:
    cursor.execute(
        "SELECT question_id, selected_option_id FROM mcq_answers WHERE attempt_id = %s",
        (attempt_id,),
    )
    selected_answers = {row["question_id"]: row["selected_option_id"] for row in cursor.fetchall()}
    cursor.execute(
        "SELECT question_id, score FROM essay_answers WHERE attempt_id = %s",
        (attempt_id,),
    )
    essay_scores = {row["question_id"]: row["score"] for row in cursor.fetchall()}
    raw_earned = Decimal("0")
    raw_possible = Decimal("0")
    for question_id, question in questions.items():
        maximum = validate_max_score(
            question["question_point_snapshot"]
            if question.get("question_point_snapshot") is not None
            else question.get("question_point")
        )
        raw_possible += maximum
        if str(_question_type(question)).lower() == "essay":
            awarded = essay_scores.get(question_id)
            if awarded is not None:
                raw_earned += Decimal(str(awarded))
            continue
        option_id = selected_answers.get(question_id)
        if option_id is None:
            continue
        option = _valid_snapshot_option(cursor, question, option_id)
        if option and bool(option.get("isCorrect")):
            raw_earned += maximum
    return raw_earned, raw_possible


def _sync_student_final_score(cursor, exam_id: int, student_id: str) -> None:
    cursor.execute("SELECT result_strategy FROM exam_setting WHERE exam_id = %s", (exam_id,))
    settings = cursor.fetchone()
    strategy = settings["result_strategy"] if settings else "highest"
    cursor.execute(
        """
        SELECT score FROM attempt
        WHERE exam_id = %s AND student_id = %s AND submitted_at IS NOT NULL
          AND status IN ('submitted', 'terminated')
          AND score_scale_version = 2
          AND NOT EXISTS (
              SELECT 1 FROM essay_answers ea
              WHERE ea.attempt_id = attempt.attempt_id
                AND ea.score IS NULL
                AND TRIM(REPLACE(REPLACE(REPLACE(COALESCE(ea.answer_text, ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), '')) <> ''
          )
        ORDER BY attempt_no, submitted_at, attempt_id
        """,
        (exam_id, student_id),
    )
    score_rows = cursor.fetchall()
    scores = [Decimal(str(row["score"])) for row in score_rows if row["score"] is not None]
    final_score = None
    if scores:
        if strategy == "average":
            final_score = round(sum(scores, Decimal("0")) / len(scores), 2)
        elif strategy == "last_attempt":
            latest_score = score_rows[-1]["score"] if score_rows else None
            final_score = Decimal(str(latest_score)) if latest_score is not None else None
        else:
            final_score = max(scores)
    cursor.execute(
        "UPDATE student_exam SET final_score = %s WHERE exam_id = %s AND student_id = %s",
        (final_score, exam_id, student_id),
    )


def saveAttemptAnswer(attempt_id: int, exam_id: int, question_id: int, answer: dict):
    """Atomically validate and persist the latest answer for one question."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cnx.start_transaction()
        cursor.execute(
            """
            SELECT a.status, a.submitted_at, a.end_time, a.start_time,
                   e.duration_minutes, e.end_time AS exam_end_time
            FROM attempt a JOIN exam e ON e.exam_id = a.exam_id
            WHERE a.attempt_id = %s FOR UPDATE
            """,
            (attempt_id,),
        )
        attempt = cursor.fetchone()
        if not attempt or attempt["status"] != "in_progress" or attempt["submitted_at"] or attempt["end_time"]:
            raise Exception("Attempt is no longer in progress")
        cursor.execute("SELECT NOW() AS database_now")
        database_now = cursor.fetchone()["database_now"]
        duration_expiry = attempt["start_time"] + timedelta(minutes=int(attempt["duration_minutes"] or 0))
        expires_at = min(duration_expiry, attempt["exam_end_time"]) if attempt["exam_end_time"] else duration_expiry
        if database_now >= expires_at:
            cnx.rollback()
            finalizeAttempt(attempt_id, exam_id, [])
            raise Exception("Attempt has expired")
        questions = _load_attempt_questions(cursor, attempt_id, exam_id)
        question = questions.get(question_id)
        if not question:
            raise Exception("Question does not belong to this attempt")
        cursor.execute("SELECT sequential_navigation FROM exam_setting WHERE exam_id = %s", (exam_id,))
        settings = cursor.fetchone()
        if settings and settings["sequential_navigation"]:
            _validate_sequential_save(questions, _answered_question_ids(cursor, attempt_id), question_id)
        _upsert_answer(cursor, attempt_id, question, answer)
        cursor.execute("UPDATE attempt SET last_saved_at = NOW() WHERE attempt_id = %s", (attempt_id,))
        cursor.execute("SELECT last_saved_at FROM attempt WHERE attempt_id = %s", (attempt_id,))
        saved_at = cursor.fetchone()["last_saved_at"]
        cnx.commit()
        return saved_at
    except Exception:
        cnx.rollback()
        raise
    finally:
        cursor.close()
        cnx.close()


def finalizeAttempt(attempt_id: int, exam_id: int, answers: list, status: str = "submitted", reason: str | None = None):
    """Upsert supplied answers, grade snapshot MCQs, and close an attempt once."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cnx.start_transaction()
        cursor.execute(
            "SELECT status, submitted_at, end_time, score, student_id FROM attempt WHERE attempt_id = %s FOR UPDATE",
            (attempt_id,),
        )
        attempt = cursor.fetchone()
        if not attempt:
            raise Exception("Attempt not found")
        if attempt["status"] in {"submitted", "terminated"}:
            questions = _load_attempt_questions(cursor, attempt_id, exam_id)
            raw_earned, raw_possible = _attempt_raw_scores(cursor, attempt_id, questions)
            essay_pending = _essay_pending(cursor, attempt_id)
            cnx.commit()
            return {
                "score": attempt["score"],
                "rawEarnedScore": raw_earned,
                "rawPossibleScore": raw_possible,
                "gradingScale": GRADING_SCALE,
                "essayPending": essay_pending,
                "status": attempt["status"],
                "idempotent": True,
            }
        if attempt["status"] != "in_progress" or attempt["submitted_at"] or attempt["end_time"]:
            raise Exception("Attempt is no longer in progress")
        questions = _load_attempt_questions(cursor, attempt_id, exam_id)
        cursor.execute("SELECT sequential_navigation FROM exam_setting WHERE exam_id = %s", (exam_id,))
        settings = cursor.fetchone()
        if status == "submitted" and settings and settings["sequential_navigation"]:
            _validate_sequential_submit(questions, _answered_question_ids(cursor, attempt_id), answers)
        for answer in answers:
            question_id = int(answer["questionId"])
            question = questions.get(question_id)
            if not question:
                raise Exception("Question does not belong to this attempt")
            _upsert_answer(cursor, attempt_id, question, answer)

        _finalize_essay_answers(cursor, attempt_id, questions)

        raw_earned, raw_possible = _attempt_raw_scores(cursor, attempt_id, questions)
        if status == "terminated":
            # A terminated attempt is final, including any submitted essay work.
            cursor.execute("UPDATE essay_answers SET score = 0 WHERE attempt_id = %s AND score IS NULL", (attempt_id,))
            total_score = Decimal("0.00")
        else:
            total_score = normalize_score(raw_earned, raw_possible)
        essay_pending = _essay_pending(cursor, attempt_id)
        cursor.execute(
            """
            UPDATE attempt
            SET score = %s, end_time = NOW(), submitted_at = NOW(), status = %s,
                termination_reason = %s, score_scale_version = 2
            WHERE attempt_id = %s
            """,
            (total_score, status, reason, attempt_id),
        )
        if status == "terminated":
            cursor.execute(
                """
                INSERT INTO exam_event (attempt_id, event_type, event_timestamp, details, source, is_violation)
                VALUES (%s, %s, NOW(), %s, 'system', 0)
                """,
                (attempt_id, "ATTEMPT_TERMINATED", reason or "anti_cheat"),
            )
        else:
            cursor.execute(
                """
                INSERT INTO exam_event (attempt_id, event_type, event_timestamp, details, source, is_violation)
                VALUES (%s, 'ATTEMPT_SUBMITTED', NOW(), NULL, 'system', 0)
                """,
                (attempt_id,),
            )
        _sync_student_final_score(cursor, exam_id, attempt["student_id"])
        cnx.commit()
        return {
            "score": total_score,
            "rawEarnedScore": raw_earned,
            "rawPossibleScore": raw_possible,
            "gradingScale": GRADING_SCALE,
            "essayPending": essay_pending,
            "status": status,
            "idempotent": False,
        }
    except Exception:
        cnx.rollback()
        raise
    finally:
        cursor.close()
        cnx.close()


def submitAttempt(attempt_id: int, exam_id: int, answers: list):
    """Backward-compatible entry point; the active atomic finalizer owns scoring."""
    return finalizeAttempt(attempt_id, exam_id, answers)


def recordAntiCheatEvent(exam_id: int, student_id: str, event: dict) -> dict:
    """Persist one client event and enforce the shared limit in one transaction."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cnx.start_transaction()
        cursor.execute(
            """
            SELECT attempt_id, exam_id, student_id, status, submitted_at, end_time,
                   score, violation_count
            FROM attempt
            WHERE attempt_id = %s AND exam_id = %s AND student_id = %s
            FOR UPDATE
            """,
            (event["attemptId"], exam_id, student_id),
        )
        attempt = cursor.fetchone()
        if not attempt:
            raise Exception("Attempt does not belong to student")

        cursor.execute(
            "SELECT anti_cheat_enabled, violation_limit FROM exam_setting WHERE exam_id = %s",
            (exam_id,),
        )
        setting = cursor.fetchone() or {"anti_cheat_enabled": False, "violation_limit": 5}
        enabled = bool(setting["anti_cheat_enabled"])
        limit = int(setting["violation_limit"] or 5)
        client_event_id = event["clientEventId"]

        cursor.execute(
            "SELECT event_id FROM exam_event WHERE attempt_id = %s AND client_event_id = %s",
            (attempt["attempt_id"], client_event_id),
        )
        duplicate = cursor.fetchone() is not None
        if duplicate:
            cnx.commit()
            return _event_response(attempt, enabled, limit, event_accepted=True, duplicate=True)

        if attempt["status"] in {"submitted", "terminated"} or attempt["submitted_at"] or attempt["end_time"]:
            cnx.commit()
            return _event_response(attempt, enabled, limit, event_accepted=False, duplicate=False)

        event_type = event["eventType"]
        is_violation = enabled and event_type in VIOLATION_EVENT_TYPES
        # Disabled exams retain a non-violation diagnostic event for auditing.
        cursor.execute(
            """
            INSERT INTO exam_event (
                attempt_id, event_type, event_timestamp, details, source,
                is_violation, client_event_id, metadata
            ) VALUES (%s, %s, NOW(), %s, %s, %s, %s, %s)
            """,
            (
                attempt["attempt_id"], event_type, event.get("details"), event["source"],
                int(is_violation), client_event_id, json.dumps(event["metadata"]) if event.get("metadata") is not None else None,
            ),
        )
        if is_violation:
            cursor.execute(
                """
                UPDATE attempt
                SET violation_count = violation_count + 1, last_violation_at = NOW()
                WHERE attempt_id = %s
                """,
                (attempt["attempt_id"],),
            )
            attempt["violation_count"] = int(attempt["violation_count"] or 0) + 1

        if is_violation and attempt["violation_count"] >= limit:
            questions = _load_attempt_questions(cursor, attempt["attempt_id"], exam_id)
            for answer in event.get("answers", []):
                question = questions.get(int(answer["questionId"]))
                if not question:
                    raise Exception("Question does not belong to this attempt")
                _upsert_answer(cursor, attempt["attempt_id"], question, answer)
            _finalize_essay_answers(cursor, attempt["attempt_id"], questions)
            cursor.execute("UPDATE essay_answers SET score = 0 WHERE attempt_id = %s AND score IS NULL", (attempt["attempt_id"],))
            reason = f"anti_cheat_limit_reached:{event_type}"
            cursor.execute(
                """
                UPDATE attempt
                SET score = 0.00, end_time = NOW(), submitted_at = NOW(), status = 'terminated',
                    termination_reason = %s, score_scale_version = 2
                WHERE attempt_id = %s
                """,
                (reason, attempt["attempt_id"]),
            )
            cursor.execute(
                """
                INSERT INTO exam_event (attempt_id, event_type, event_timestamp, details, source, is_violation)
                VALUES (%s, 'ATTEMPT_TERMINATED', NOW(), %s, 'system', 0)
                """,
                (attempt["attempt_id"], reason),
            )
            attempt.update(status="terminated", score=Decimal("0.00"), submitted_at=True, end_time=True)
            _sync_student_final_score(cursor, exam_id, student_id)

        cnx.commit()
        return _event_response(attempt, enabled, limit, event_accepted=True, duplicate=False)
    except Exception:
        cnx.rollback()
        raise
    finally:
        cursor.close()
        cnx.close()


def _event_response(attempt: dict, enabled: bool, limit: int, event_accepted: bool, duplicate: bool) -> dict:
    count = int(attempt.get("violation_count") or 0)
    terminated = attempt.get("status") == "terminated"
    return {
        "success": True,
        "eventAccepted": event_accepted,
        "duplicate": duplicate,
        "antiCheatEnabled": enabled,
        "violationCount": count,
        "violationLimit": limit,
        "remainingViolations": max(limit - count, 0) if enabled else None,
        "terminated": terminated,
        "attemptStatus": attempt.get("status"),
        "score": attempt.get("score"),
        "warningMessage": "Attempt terminated after reaching the violation limit." if terminated else (
            "Anti-cheat is disabled; the event was recorded without a violation." if not enabled else "Anti-cheat event recorded."
        ),
    }

def addQuestionToExam(exam_id: int, question_data: dict):
    """Add a question to an exam."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    try:
        question_id = insertQuestion(
            question_text=question_data["text"],
            question_type=question_data["type"],
        )

        insert_exam_question_query = """
        INSERT INTO exam_question (exam_id, question_id)
        VALUES (%s, %s)
        """
        cursor.execute(insert_exam_question_query, (exam_id, question_id))

        if question_data["type"] == "multiple-choice" | question_data["type"] == "TF":
            insert_option_query = """
            INSERT INTO options (question_id, options_text, is_correct)
            VALUES (%s, %s, %s)
            """
            for option in question_data.get("options", []):
                cursor.execute(insert_option_query, (
                    question_id,
                    option["text"],
                    option.get("is_correct", False)
                ))
        # if question_data["type"] == "essay":
        #     insert_essay_query = """
        #     INSERT INTO essay_answers (attempt_id, question_id, answer_text, score)
        #     VALUES (NULL, %s, NULL, NULL)
        #     """
        #     cursor.execute(insert_essay_query, (question_id,))
        if question_data["type"] == "multiple-answer":
            insert_option_query = """
            INSERT INTO options (question_id, options_text, is_correct)
            VALUES (%s, %s, %s)
            """
            for option in question_data.get("options", []):
                cursor.execute(insert_option_query, (
                    question_id,
                    option["text"],
                    option.get("is_correct", False)
                ))
        cnx.commit()
    except Exception as e:
        cnx.rollback()
        raise e
    finally:
        cursor.close()
        cnx.close()
        
def returnSubject():
    """Return all subjects with question count."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT 
        s.subject_id,
        s.subject_name,
        s.subject_description,
        COALESCE(COUNT(q.question_id), 0) as question_count
    FROM subject s
    LEFT JOIN question q ON s.subject_id = q.subject_id
    GROUP BY s.subject_id, s.subject_name, s.subject_description
    ORDER BY s.subject_name
    LIMIT 5
    """
    try:
        cursor.execute(query)
        result = cursor.fetchall()
        return result
    except Exception as e:
        print(f"ERROR in returnSubject: {str(e)}")
        raise e
    finally:
        cursor.close()
        cnx.close()

def returnTotalStudentCount(teacher_id: str):
    """Return the total count of students for a specific teacher."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
        SELECT COUNT(DISTINCT se.student_id) AS total_students
        FROM student_exam se
        JOIN exam e
            ON se.exam_id = e.exam_id
        WHERE e.manage_by = %s;
        """
    try:
        cursor.execute(query, (teacher_id,))
        result = cursor.fetchone()
        return result['total_students'] if result else 0
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()

def returnActiveExam (teacher_id: str):
    """Return the active exam for a specific teacher."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT * FROM exam WHERE manage_by = %s AND start_time <= NOW() AND end_time >= NOW()
    """
    try:
        cursor.execute(query, (teacher_id,))
        result = cursor.fetchone()
        if result:
            result['totalStudents'] = getStudentExamCount(result['exam_id'])
            result['status'] = _get_exam_status(result['start_time'], result['end_time'])
            result['subject'] = returnExamSubject(result['exam_id'])
        return result
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()

def returnUpcomingExam (teacher_id: str):
    """Return the upcoming exam for a specific teacher."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT * FROM exam WHERE manage_by = %s AND start_time > NOW() ORDER BY start_time ASC LIMIT 4
    """
    try:
        cursor.execute(query, (teacher_id,))
        result = cursor.fetchall()
        if result:
            for exam in result:
                exam['totalStudents'] = getStudentExamCount(exam['exam_id'])
                exam['status'] = _get_exam_status(exam['start_time'], exam['end_time'])
                exam['subject'] = returnExamSubject(exam['exam_id'])
        return result
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()
