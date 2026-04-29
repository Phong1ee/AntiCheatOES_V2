from src.a_db_config.config import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash


def registerUser(fullname, email, password, role):
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
        
        # Hash the password before storing
        password_hash = generate_password_hash(password)

        # Insert new user
        query = "INSERT INTO user (full_name, email, password_hash, role) VALUES (%s, %s, %s, %s)"
        cursor.execute(query, (fullname, email, password_hash, role))
        cnx.commit()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()
    


def verifyUser(email, password):
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = "SELECT full_name, email, role, password_hash FROM user WHERE email = %s"
    try:
        cursor.execute(query, (email,))
        result = cursor.fetchone()
        
        if result and check_password_hash(result[3], password):
            return result[:3]  # Return user details (full_name, email, role)
        return None
    
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


    