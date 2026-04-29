from src.a_db_config.config import get_db_connection

def getExam():
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = "SELECT * FROM exam"
    try:
        cursor.execute(query)
        result = cursor.fetchall()
        return result
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()