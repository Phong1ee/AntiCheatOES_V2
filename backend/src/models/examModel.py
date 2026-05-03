from src.a_db_config.config import get_db_connection
from datetime import datetime

def getStudentExams(school_id: str):
    """Get all exams assigned to a specific student."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    
    # Debug: Print what we're looking for
    print(f"DEBUG: Looking for exams for school_id = {school_id}")
    
    query = """
    SELECT e.exam_id, e.title, e.description, e.duration_minutes, e.max_attempt,
           e.start_time, e.end_time
    FROM exam e
    JOIN student_exam se ON e.exam_id = se.exam_id
    WHERE se.student_id = %s
    """
    try:
        cursor.execute(query, (school_id,))
        results = cursor.fetchall()
        
        # Calculate status for each exam based on current time
        now = datetime.now()
        for exam in results:
            if exam['start_time'] and exam['end_time']:
                if now < exam['start_time']:
                    exam['status'] = 'upcoming'
                elif now <= exam['end_time']:
                    exam['status'] = 'open'
                else:
                    exam['status'] = 'completed'
            else:
                exam['status'] = 'open'  # Default if no times set
        
        # Debug: Print what we found
        print(f"DEBUG: Found {len(results)} exams")
        print(f"DEBUG: Result = {results}")
        
        return results
    except Exception as e:
        print(f"DEBUG: Error = {e}")
        raise e
    finally:
        cursor.close()
        cnx.close()
        
def getExamById(exam_id: int):
    """Get exam details by ID."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = "SELECT exam_id, title, description, duration_minutes, max_attempt FROM exam WHERE exam_id = %s"
    try:
        cursor.execute(query, (exam_id,))
        result = cursor.fetchone()
        return result
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()

def getExamQuestions(exam_id: int):
    """Get all questions for a specific exam with their options."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    
    query = """
    SELECT q.question_id, q.question_text, q.question_type, eq.question_point
    FROM exam_question eq
    JOIN question q ON eq.question_id = q.question_id
    WHERE eq.exam_id = %s
    ORDER BY eq.question_id
    """
    
    try:
        cursor.execute(query, (exam_id,))
        questions = cursor.fetchall()
        
        # For each question, fetch options if it's MCQ
        for question in questions:
            if question['question_type'] == 'MCQ':
                options_query = "SELECT options_id, options_text, is_correct FROM options WHERE question_id = %s"
                cursor.execute(options_query, (question['question_id'],))
                options = cursor.fetchall()
                question['options'] = options
            else:
                question['options'] = []
        
        return questions
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()

def getExam(school_id: str):
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    SELECT e.exam_id, e.title, e.description, e.duration_minutes
    FROM exam e
    JOIN student_exam se ON e.exam_id = se.exam_id
    WHERE se.student_id = %s
    """
    try:
        cursor.execute(query, (school_id,))
        result = cursor.fetchall()
        return result
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()

