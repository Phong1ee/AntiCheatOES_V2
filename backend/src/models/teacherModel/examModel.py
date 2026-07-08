from datetime import datetime
from src.a_db_config.config import get_db_connection

def _get_exam_status(start_time, end_time):
    """Calculate exam status based on start and end times."""
    now = datetime.now()
    
    if now < start_time:
        return "upcoming"
    elif start_time <= now <= end_time:
        return "ongoing"
    else:
        return "completed"

def get_exams_by_teacher(teacher_id: str):
    """Get all exams created by a specific teacher."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT * from exam WHERE manage_by = %s
    """
    try:
        cursor.execute(query, (teacher_id,))
        result = cursor.fetchall()
        
        # Add student count, status, and subject for each exam
        for exam in result:
            try:
                exam['totalStudents'] = getStudentExamCount(exam['exam_id'])
                exam['status'] = _get_exam_status(exam['start_time'], exam['end_time'])
                exam['subject'] = returnExamSubject(exam['exam_id'])
            except Exception:
                exam['totalStudents'] = 0
                exam['status'] = 'upcoming'
                exam['subject'] = None
        return result
    except Exception as e:
        print(f"ERROR in get_exams_by_teacher: {str(e)}")
        raise e
    finally:
        cursor.close()
        cnx.close()

def getStudentExamCount(Exam_id: int):
    """Get the count of students assigned to a specific exam."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT COUNT(*) as student_count FROM student_exam WHERE exam_id = %s
    """
    try:
        cursor.execute(query, (Exam_id,))
        result = cursor.fetchone()
        return result['student_count']
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


def returnExamSubject (exam_id: int):
    """Return the subject of a specific exam."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT
    e.exam_id,
    e.title,
    s.subject_name
    FROM exam e
    JOIN subject s
        ON e.subject_id = s.subject_id
    WHERE e.exam_id = %s;
        """
    try:
        cursor.execute(query, (exam_id,))
        result = cursor.fetchone()
        return result['subject_name'] if result else None
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
    LEFT JOIN chapter c ON s.subject_id = c.subject_id
    LEFT JOIN question q ON c.chapter_id = q.chapter_id
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
