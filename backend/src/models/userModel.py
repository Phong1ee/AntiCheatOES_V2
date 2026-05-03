from src.a_db_config.config import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
import random


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
        school_id = generate_school_id(role)
        
        # Insert new user
        query = "INSERT INTO user (school_id, full_name, email, password_hash, role) VALUES (%s, %s, %s, %s, %s)"
        cursor.execute(query, (school_id, fullname, email, password_hash, role))
        cnx.commit()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()
    


def verifyUser(email, password):
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = "SELECT full_name, email, role, password_hash, school_id FROM user WHERE email = %s"
    try:
        cursor.execute(query, (email,))
        result = cursor.fetchone()
        
        if result and check_password_hash(result[3], password):
            print ("User authenticated successfully")
            return result  # Return all user details (full_name, email, role, password_hash, school_id)
        return None
    
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()

def generate_school_id(role):
    """Generate a unique school ID"""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    # Simple implementation: use the first 3 letters of the name + a random number
    if role == "student":
        prefix = "S"
    elif role == "teacher":
        prefix = "T"

    query = "SELECT COUNT(*) FROM user WHERE role = %s"
    cursor.execute(query, (role,))
    count = cursor.fetchone()[0] + 1
    postfix = f"{count:06d}"  # Format as 6-digit number
    return f"{prefix}{postfix}"


    