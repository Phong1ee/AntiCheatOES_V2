from datetime import datetime
from src.a_db_config.config import get_db_connection

from src.service.exam_pool_service import seeded_random, select_unique_candidates
from src.service.scoring_service import GRADING_SCALE, normalize_score, validate_max_score
from src.service.anti_cheat_event_policy import validate_event_payload


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_attempt_session_token() -> str:
    return secrets.token_urlsafe(32)


def assertAttemptSession(exam_id: int, attempt_id: int, student_id: str, device_id: str, session_token: str) -> None:
    """Validate an active attempt session without exposing stored hashes."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT device_id_hash, session_token_hash, status, submitted_at, end_time
            FROM attempt WHERE attempt_id = %s AND exam_id = %s AND student_id = %s
            """,
            (attempt_id, exam_id, student_id),
        )
        attempt = cursor.fetchone()
        if not attempt or attempt["status"] != "in_progress" or attempt["submitted_at"] or attempt["end_time"]:
            raise Exception("Attempt is no longer in progress")
        if not attempt["device_id_hash"] or not hmac.compare_digest(attempt["device_id_hash"], _sha256(device_id)):
            raise Exception("Attempt device does not match")
        if not attempt["session_token_hash"] or not hmac.compare_digest(attempt["session_token_hash"], _sha256(session_token)):
            raise Exception("Attempt session is invalid")
    finally:
        cursor.close()
        cnx.close()


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
        e.examcode,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        COUNT(a.attempt_id) AS attempts_used,
        e.start_time,
        e.end_time,
        e.result_visibility
    FROM student_exam se
    JOIN user u
        ON u.school_id = se.student_id
    JOIN exam e
        ON e.exam_id = se.exam_id
    LEFT JOIN attempt a
        ON a.exam_id = e.exam_id
        AND a.student_id = u.id
    WHERE se.student_id = %s
    GROUP BY
        e.exam_id,
        e.title,
        e.examcode,
        e.description,
        e.duration_minutes,
        e.max_attempt,
        e.start_time,
        e.end_time,
        e.result_visibility
    ORDER BY e.start_time ASC, e.exam_id ASC
    """
    try:
        cursor.execute(query, (school_id,))
        exams = cursor.fetchall()
        now_time = datetime.now()

        for exam in exams:
            attempts_used = int(exam["attempts_used"] or 0)
            max_attempt = exam["max_attempt"]

            if max_attempt is None or int(max_attempt) <= 0:
                remaining_attempts = None
            else:
                remaining_attempts = max(int(max_attempt) - attempts_used, 0)

            if max_attempt is not None and int(max_attempt) > 0 and attempts_used >= int(max_attempt):
                status = "completed"
            elif exam["start_time"] and now_time < exam["start_time"]:
                status = "upcoming"
            elif exam["start_time"] and exam["end_time"] and exam["start_time"] <= now_time <= exam["end_time"]:
                status = "open"
            elif exam["end_time"] and now_time > exam["end_time"]:
                status = "closed"
            else:
                status = "open"

            exam["attempts_used"] = attempts_used
            exam["remaining_attempts"] = remaining_attempts
            exam["status"] = status

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
        e.result_visibility
    FROM student_exam se
    JOIN user u
        ON u.school_id = se.student_id
    JOIN exam e
        ON e.exam_id = se.exam_id
    LEFT JOIN attempt a
        ON a.exam_id = e.exam_id
        AND a.student_id = u.id
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
        e.result_visibility
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


def getExamQuestions(exam_id: int):
    """Get exam questions and student-safe options without correct answers."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    question_query = """
    SELECT
        q.question_id,
        q.question_text,
        q.question_type,
        eq.question_point
    FROM exam_question eq
    JOIN question q
        ON q.question_id = eq.question_id
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
        cursor.execute(question_query, (exam_id,))
        question_rows = cursor.fetchall()
        questions = []

        for row in question_rows:
            question_type = (
                "multiple-choice" if row["question_type"] == "MCQ" else row["question_type"]
            )
            options = []

            if question_type in {"multiple-choice", "true-false"}:
                cursor.execute(options_query, (row["question_id"],))
                option_rows = cursor.fetchall()
                options = [
                    {
                        "id": option["options_id"],
                        "text": option["options_text"]
                    }
                    for option in option_rows
                ]

            questions.append({
                "id": row["question_id"],
                "question_id": row["question_id"],
                "text": row["question_text"],
                "type": question_type,
                "points": row["question_point"],
                "options": options
            })

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
    SELECT exam_id, examcode, max_attempt, duration_minutes, start_time, end_time
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


def countStudentAttempts(exam_id: int, student_id: int):
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


def getOpenAttempt(exam_id: int, student_id: int):
    """Get an existing open attempt for the same exam and student."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT attempt_id, attempt_no, exam_id, student_id, start_time
    FROM attempt
    WHERE exam_id = %s
      AND student_id = %s
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


def createAttempt(exam_id: int, student_id: int, attempt_no: int):
    """Create a new attempt row for a student exam."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    INSERT INTO attempt (
        exam_id,
        student_id,
        attempt_no,
        score,
        start_time,
        end_time,
        submitted_at
    )
    VALUES (%s, %s, %s, NULL, NOW(), NULL, NULL)
    """
    try:
        cursor.execute(query, (exam_id, student_id, attempt_no))
        cnx.commit()
        return cursor.lastrowid
    except Exception as e:
        cnx.rollback()
        raise e
    finally:
        cursor.close()
        cnx.close()


def getAttemptById(attempt_id: int):
    """Get attempt by id."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT attempt_id, exam_id, student_id, attempt_no, score, start_time, end_time, submitted_at
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


def submitAttempt(attempt_id: int, exam_id: int, answers: list):
    """Save MCQ and essay answers, auto-grade MCQ, and close the attempt."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        question_query = """
        SELECT q.question_id, q.question_type, eq.question_point
        FROM exam_question eq
        JOIN question q ON q.question_id = eq.question_id
        WHERE eq.exam_id = %s
        """
        cursor.execute(question_query, (exam_id,))
        question_rows = cursor.fetchall()
        question_map = {row["question_id"]: row for row in question_rows}

        delete_mcq_query = "DELETE FROM mcq_answers WHERE attempt_id = %s"
        delete_essay_query = "DELETE FROM essay_answers WHERE attempt_id = %s"
        delete_attempt_question_query = "DELETE FROM attempt_question WHERE attempt_id = %s"
        cursor.execute(delete_mcq_query, (attempt_id,))
        cursor.execute(delete_essay_query, (attempt_id,))
        cursor.execute(delete_attempt_question_query, (attempt_id,))

        insert_attempt_question_query = """
        INSERT INTO attempt_question (attempt_id, question_id, display_order)
        VALUES (%s, %s, %s)
        """
        insert_mcq_query = """
        INSERT INTO mcq_answers (attempt_id, question_id, selected_option_id)
        VALUES (%s, %s, %s)
        """
        insert_essay_query = """
        INSERT INTO essay_answers (attempt_id, question_id, answer_text, score)
        VALUES (%s, %s, %s, NULL)
        """
        option_by_text_query = """
        SELECT options_id, is_correct
        FROM options
        WHERE question_id = %s AND LOWER(options_text) = LOWER(%s)
        LIMIT 1
        """
        option_by_id_query = """
        SELECT options_id, is_correct
        FROM options
        WHERE question_id = %s AND options_id = %s
        LIMIT 1
        """

        total_score = 0
        essay_pending = False

        for index, answer in enumerate(answers, start=1):
            question_id = int(answer["questionId"])
            question_info = question_map.get(question_id)

            if not question_info:
                raise Exception(f"Question {question_id} does not belong to this exam")

            selected_option_id = answer.get("selectedOptionId")
            answer_text = (answer.get("answerText") or "").strip()

            cursor.execute(insert_attempt_question_query, (attempt_id, question_id, index))

            if question_info["question_type"] == "essay":
                if not answer_text:
                    raise Exception(f"Missing essay answer for question {question_id}")

                cursor.execute(insert_essay_query, (attempt_id, question_id, answer_text))
                essay_pending = True
                continue

            if selected_option_id is not None:
                cursor.execute(option_by_id_query, (question_id, int(selected_option_id)))
            elif answer_text:
                cursor.execute(option_by_text_query, (question_id, answer_text))
            else:
                raise Exception(f"Missing answer for question {question_id}")

            option_row = cursor.fetchone()
            if not option_row:
                raise Exception(f"Invalid selected option for question {question_id}")

            cursor.execute(insert_mcq_query, (attempt_id, question_id, option_row["options_id"]))
            if option_row["is_correct"]:
                total_score += int(question_info["question_point"] or 0)

        update_attempt_query = """
        UPDATE attempt
        SET score = %s,
            end_time = NOW(),
            submitted_at = NOW()
        WHERE attempt_id = %s
        """
        cursor.execute(update_attempt_query, (total_score, attempt_id))
        cnx.commit()

        return {
            "score": total_score,
            "essayPending": essay_pending
        }
    except Exception as e:
        cnx.rollback()
        raise e
    finally:
        cursor.close()
        cnx.close()



def submitAttempt(attempt_id: int, exam_id: int, answers: list):
    """Backward-compatible entry point; the active atomic finalizer owns scoring."""
    return finalizeAttempt(attempt_id, exam_id, answers)


def resumeAttempt(exam_id: int, attempt_id: int, student_id: str, device_id: str) -> tuple[dict, str, bool]:
    """Claim a legacy attempt once or rotate the session on its bound browser."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cnx.start_transaction()
        cursor.execute(
            """
            SELECT attempt_id, exam_id, student_id, attempt_no, status, submitted_at, end_time,
                   score, violation_count, device_id_hash
            FROM attempt WHERE attempt_id = %s AND exam_id = %s AND student_id = %s FOR UPDATE
            """,
            (attempt_id, exam_id, student_id),
        )
        attempt = cursor.fetchone()
        if not attempt or attempt["status"] != "in_progress" or attempt["submitted_at"] or attempt["end_time"]:
            raise Exception("Attempt is no longer in progress")
        device_hash = _sha256(device_id)
        claimed_legacy = attempt["device_id_hash"] is None
        if not claimed_legacy and not hmac.compare_digest(attempt["device_id_hash"], device_hash):
            raise Exception("Attempt device does not match")
        session_token = create_attempt_session_token()
        cursor.execute(
            """
            UPDATE attempt
            SET device_id_hash = %s, session_token_hash = %s, last_heartbeat_at = NOW()
            WHERE attempt_id = %s
            """,
            (device_hash, _sha256(session_token), attempt_id),
        )
        if claimed_legacy:
            cursor.execute(
                """
                INSERT INTO exam_event (attempt_id, event_type, event_timestamp, details, source, is_violation)
                VALUES (%s, 'DEVICE_BOUND_ON_RESUME', NOW(), NULL, 'system', 0)
                """,
                (attempt_id,),
            )
        cnx.commit()
        return attempt, session_token, claimed_legacy
    except Exception:
        cnx.rollback()
        raise
    finally:
        cursor.close()
        cnx.close()


def heartbeatAttempt(exam_id: int, attempt_id: int, student_id: str, device_id: str, session_token: str) -> dict:
    assertAttemptSession(exam_id, attempt_id, student_id, device_id, session_token)
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cursor.execute("UPDATE attempt SET last_heartbeat_at = NOW() WHERE attempt_id = %s", (attempt_id,))
        cnx.commit()
        cursor.execute("SELECT last_heartbeat_at, violation_count, status FROM attempt WHERE attempt_id = %s", (attempt_id,))
        return cursor.fetchone()
    except Exception:
        cnx.rollback()
        raise
    finally:
        cursor.close()
        cnx.close()


def recordAntiCheatEvent(exam_id: int, student_id: str, event: dict, device_id: str = "", session_token: str = "") -> dict:
    """Persist one client event and enforce the shared limit in one transaction."""
    policy = validate_event_payload(event["eventType"], event["source"], event.get("metadata"))
    event_type = event["eventType"].strip().upper()
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cnx.start_transaction()
        cursor.execute(
            """
            SELECT attempt_id, exam_id, student_id, status, submitted_at, end_time,
                   score, violation_count, device_id_hash, session_token_hash
            FROM attempt
            WHERE attempt_id = %s AND exam_id = %s AND student_id = %s
            FOR UPDATE
            """,
            (event["attemptId"], exam_id, student_id),
        )
        attempt = cursor.fetchone()
        if not attempt:
            raise Exception("Attempt does not belong to student")
        if device_id and (not attempt["device_id_hash"] or not hmac.compare_digest(attempt["device_id_hash"], _sha256(device_id))):
            raise Exception("Attempt device does not match")
        if session_token and (not attempt["session_token_hash"] or not hmac.compare_digest(attempt["session_token_hash"], _sha256(session_token))):
            raise Exception("Attempt session is invalid")

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
            return _event_response(attempt, enabled, limit, policy, event_accepted=True, duplicate=True)

        if attempt["status"] in {"submitted", "terminated"} or attempt["submitted_at"] or attempt["end_time"]:
            cnx.commit()
            return _event_response(attempt, enabled, limit, policy, event_accepted=False, duplicate=False)

        is_violation = enabled and policy.counts_toward_limit
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
        return _event_response(attempt, enabled, limit, policy, event_accepted=True, duplicate=False)
    except Exception:
        cnx.rollback()
        raise
    finally:
        cursor.close()
        cnx.close()


def _event_response(attempt: dict, enabled: bool, limit: int, policy, event_accepted: bool, duplicate: bool) -> dict:
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
        "automatedFlag": policy.automated_flag,
        "countsTowardLimit": policy.counts_toward_limit,
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

