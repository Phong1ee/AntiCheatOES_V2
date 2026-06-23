from src.a_db_config.config import get_db_connection


def getStudentAttempts(student_id: int):
    """Get all attempts for a student with related exam info."""
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
        e.title AS exam_title,
        e.duration_minutes,
        e.max_attempt,
        e.result_visibility
    FROM attempt a
    JOIN exam e
        ON e.exam_id = a.exam_id
    WHERE a.student_id = %s
    ORDER BY COALESCE(a.submitted_at, a.end_time, a.start_time) DESC, a.attempt_id DESC
    """
    try:
        cursor.execute(query, (student_id,))
        return cursor.fetchall()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getExamSubject(exam_id: int):
    """Resolve subject names for an exam through question -> chapter -> subject."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT GROUP_CONCAT(DISTINCT s.subject_name ORDER BY s.subject_name SEPARATOR ', ') AS subject
    FROM exam_question eq
    JOIN question q
        ON q.question_id = eq.question_id
    LEFT JOIN chapter c
        ON c.chapter_id = q.chapter_id
    LEFT JOIN subject s
        ON s.subject_id = c.subject_id
    WHERE eq.exam_id = %s
    """
    try:
        cursor.execute(query, (exam_id,))
        result = cursor.fetchone()
        return result["subject"] if result and result["subject"] else "General"
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getExamQuestionCount(exam_id: int):
    """Count total questions in an exam."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    SELECT COUNT(*)
    FROM exam_question
    WHERE exam_id = %s
    """
    try:
        cursor.execute(query, (exam_id,))
        result = cursor.fetchone()
        return int(result[0] or 0)
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getCorrectMcqCount(attempt_id: int):
    """Count correctly answered MCQ questions for an attempt."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    SELECT COUNT(*)
    FROM mcq_answers ma
    JOIN options o
        ON o.options_id = ma.selected_option_id
    WHERE ma.attempt_id = %s
      AND o.is_correct = TRUE
    """
    try:
        cursor.execute(query, (attempt_id,))
        result = cursor.fetchone()
        return int(result[0] or 0)
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def hasPendingEssay(attempt_id: int):
    """Check whether an attempt has essay answers still waiting for grading."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    SELECT COUNT(*)
    FROM essay_answers
    WHERE attempt_id = %s
      AND score IS NULL
    """
    try:
        cursor.execute(query, (attempt_id,))
        result = cursor.fetchone()
        return int(result[0] or 0) > 0
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getAttemptWithExam(attempt_id: int):
    """Get one attempt with related exam info."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT
        a.attempt_id,
        a.exam_id,
        a.student_id,
        a.attempt_no,
        a.score,
        a.start_time,
        a.end_time,
        a.submitted_at,
        e.title AS exam_title,
        e.duration_minutes,
        e.max_attempt,
        e.result_visibility
    FROM attempt a
    JOIN exam e
        ON e.exam_id = a.exam_id
    WHERE a.attempt_id = %s
    LIMIT 1
    """
    try:
        cursor.execute(query, (attempt_id,))
        return cursor.fetchone()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getAttemptMcqQuestionRows(attempt_id: int):
    """Get MCQ review rows with all options for an attempt."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT
        aq.display_order,
        q.question_id,
        q.question_text,
        c.chapter_name AS topic,
        eq.question_point,
        o.options_id,
        o.options_text,
        o.is_correct,
        ma.selected_option_id
    FROM attempt_question aq
    JOIN question q
        ON q.question_id = aq.question_id
    JOIN exam_question eq
        ON eq.question_id = aq.question_id
    JOIN attempt a
        ON a.attempt_id = aq.attempt_id
       AND a.exam_id = eq.exam_id
    LEFT JOIN chapter c
        ON c.chapter_id = q.chapter_id
    LEFT JOIN options o
        ON o.question_id = q.question_id
    LEFT JOIN mcq_answers ma
        ON ma.attempt_id = aq.attempt_id
       AND ma.question_id = aq.question_id
    WHERE aq.attempt_id = %s
      AND q.question_type = 'MCQ'
    ORDER BY aq.display_order ASC, o.options_id ASC
    """
    try:
        cursor.execute(query, (attempt_id,))
        return cursor.fetchall()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getAttemptEssayQuestionRows(attempt_id: int):
    """Get essay review rows for an attempt."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT
        aq.display_order,
        q.question_id,
        q.question_text,
        c.chapter_name AS topic,
        ea.answer_text,
        ea.score
    FROM attempt_question aq
    JOIN question q
        ON q.question_id = aq.question_id
    LEFT JOIN chapter c
        ON c.chapter_id = q.chapter_id
    LEFT JOIN essay_answers ea
        ON ea.attempt_id = aq.attempt_id
       AND ea.question_id = aq.question_id
    WHERE aq.attempt_id = %s
      AND q.question_type = 'essay'
    ORDER BY aq.display_order ASC
    """
    try:
        cursor.execute(query, (attempt_id,))
        return cursor.fetchall()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()
