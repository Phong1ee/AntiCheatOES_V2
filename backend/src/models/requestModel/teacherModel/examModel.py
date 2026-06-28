from datetime import datetime
from src.a_db_config.config import get_db_connection

def insertQuestion(question_text: str, question_type: str, question_point: int):
    """Insert a new question into the database."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    INSERT INTO question (question_text, question_type, question_point)
    VALUES (%s, %s, %s)
    """
    try:
        cursor.execute(query, (question_text, question_type, question_point))
        cnx.commit()
        return cursor.lastrowid
    except Exception as e:
        cnx.rollback()
        raise e
    finally:
        cursor.close()
        cnx.close()


def get_exams_by_teacher(teacher_id: int):
    """Get all exams created by a specific teacher."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT * from exam WHERE manage_by = %s
    """
    try:
        cursor.execute(query, (teacher_id,))
        result = cursor.fetchall()
        
        # Add student count for each exam
        for exam in result:
            exam['totalStudents'] = getStudentExamCount(exam['exam_id'])
        
        return result
    except Exception as e:
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
