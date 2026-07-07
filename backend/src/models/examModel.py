from datetime import datetime
from src.a_db_config.config import get_db_connection


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
            question_type = "multiple-choice" if row["question_type"] == "MCQ" else "essay"
            options = []

            if question_type == "multiple-choice":
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

            if question_info["question_type"] != "MCQ":
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
        