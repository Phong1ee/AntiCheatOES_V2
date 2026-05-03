from src.a_db_config.config import get_db_connection
import datetime

def getStudentExams(school_id: str):
    """Get all exams assigned to a specific student."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT e.exam_id, e.title, e.description, e.duration_minutes, e.max_attempt, e.start_time, e.end_time
    FROM exam e
    JOIN student_exam se ON e.exam_id = se.exam_id
    WHERE se.student_id = %s
    """
    try:
        cursor.execute(query, (school_id,))
        result = cursor.fetchall()
        nowtime = datetime.datetime.now()
        for exam in result:
            if exam['start_time'] is None or exam['end_time'] is None:
                exam['status'] = 'open'  # Default if no times set
            elif nowtime < exam['start_time']:
                exam['status'] = 'upcoming'
            elif nowtime <= exam['end_time']:
                exam['status'] = 'open'
            else:
                exam['status'] = 'completed'

        return result
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


