from src.a_db_config.config import get_db_connection


def registerUser(fullname, email, password_hash, role):
    """Register a new user after checking if email exists."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    try:
        # Check if email already exists
        query = "SELECT email FROM user WHERE email = %s"
        cursor.execute(query, (email,))
        result = cursor.fetchone()
        if result:
            raise Exception("Email already exists")
        
        # Insert new user
        query = "INSERT INTO user (full_name, email, password_hash, role) VALUES (%s, %s, %s, %s)"
        cursor.execute(query, (fullname, email, password_hash, role))
        cnx.commit()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()
    


def verifyUser(email, password_hash):
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = "SELECT full_name, email, role FROM user WHERE email = %s AND password_hash = %s"
    try:
        cursor.execute(query, (email, password_hash))
        result = cursor.fetchone()
        return result or None
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


    