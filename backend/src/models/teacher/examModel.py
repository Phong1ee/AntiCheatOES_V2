from datetime import datetime
from decimal import Decimal

from src.a_db_config.config import get_db_connection
from src.service.exam_pool_service import distribute_points, seeded_random, select_unique_candidates


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


def getExamQuestions(exam_id: int, attempt_id: int | None = None):
    """Get exam questions and student-safe options without correct answers."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    question_query = """
    SELECT
        q.question_id,
        q.question_text,
        q.question_type,
        aq.question_point
    FROM attempt_question aq
    JOIN attempt a
        ON a.attempt_id = aq.attempt_id
    JOIN question q
        ON q.question_id = aq.question_id
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
    """Reject starting an exam whose persisted selection cannot total its maximum."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT question_selection_mode, total_points FROM exam WHERE exam_id = %s",
            (exam_id,),
        )
        exam = cursor.fetchone()
        if not exam:
            raise Exception("Exam not found")
        if str(exam["question_selection_mode"] or "manual") == "pool":
            cursor.execute(
                """
                SELECT COUNT(*) AS rule_count, COALESCE(SUM(r.draw_count), 0) AS draw_count
                FROM exam_pool_config c
                LEFT JOIN exam_pool_rule r ON r.pool_config_id = c.pool_config_id
                WHERE c.exam_id = %s
                """,
                (exam_id,),
            )
            pool = cursor.fetchone()
            if not pool or int(pool["rule_count"] or 0) == 0 or int(pool["draw_count"] or 0) == 0:
                raise Exception("Exam pool configuration is empty")
            return
        cursor.execute(
            """
            SELECT COUNT(*) AS question_count,
                   COALESCE(SUM(question_point), 0) AS assigned_points
            FROM exam_question
            WHERE exam_id = %s
            """,
            (exam_id,),
        )
        points = cursor.fetchone()
        if int(points["question_count"] or 0) == 0:
            raise Exception("Exam has no questions")
        if Decimal(str(points["assigned_points"])) != Decimal(str(exam["total_points"])):
            raise Exception("Exam question points do not match total points")
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
        submitted_at
    )
    VALUES (%s, %s, %s, NULL, NOW(), NULL, NULL)
    """
    try:
        cnx.start_transaction()
        cursor.execute(
            """
            SELECT attempt_id
            FROM attempt
            WHERE exam_id = %s AND student_id = %s
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
            "SELECT question_selection_mode, total_points FROM exam WHERE exam_id = %s FOR UPDATE",
            (exam_id,),
        )
        exam_row = cursor.fetchone()
        mode = str(exam_row[0] or "manual")
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
                SELECT rule_id, draw_count
                FROM exam_pool_rule
                WHERE pool_config_id = %s
                ORDER BY rule_id
                """,
                (config[0],),
            )
            rule_rows = cursor.fetchall()
            candidate_map: dict[int, list[int]] = {}
            draw_counts: dict[int, int] = {}
            for rule_id, draw_count in rule_rows:
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
            rng = seeded_random("order", exam_id, student_id, attempt_no, int(config[1]))
            rng.shuffle(selected_ids)
            point_map = distribute_points(exam_row[1], selected_ids)
        else:
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
                int(question_id): Decimal(str(question_point))
                for question_id, question_point in fixed_rows
            }
        cursor.executemany(
            """
            INSERT INTO attempt_question
                (attempt_id, question_id, display_order, question_point)
            VALUES (%s, %s, %s, %s)
            """,
            [
                (attempt_id, question_id, index, point_map[question_id])
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
        SELECT q.question_id, q.question_type, aq.question_point
        FROM attempt_question aq
        JOIN attempt a ON a.attempt_id = aq.attempt_id
        JOIN question q ON q.question_id = aq.question_id
        WHERE aq.attempt_id = %s AND a.exam_id = %s
        """
        cursor.execute(question_query, (attempt_id, exam_id))
        question_rows = cursor.fetchall()
        question_map = {row["question_id"]: row for row in question_rows}

        delete_mcq_query = "DELETE FROM mcq_answers WHERE attempt_id = %s"
        delete_essay_query = "DELETE FROM essay_answers WHERE attempt_id = %s"
        cursor.execute(delete_mcq_query, (attempt_id,))
        cursor.execute(delete_essay_query, (attempt_id,))
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

        total_score = Decimal("0.00")
        essay_pending = False

        for index, answer in enumerate(answers, start=1):
            question_id = int(answer["questionId"])
            question_info = question_map.get(question_id)

            if not question_info:
                raise Exception(f"Question {question_id} does not belong to this exam")

            selected_option_id = answer.get("selectedOptionId")
            answer_text = (answer.get("answerText") or "").strip()

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
                total_score += Decimal(str(question_info["question_point"] or 0))

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

