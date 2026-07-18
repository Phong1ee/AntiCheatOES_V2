from src.a_db_config.config import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash


def registerUser(fullname, email, password, role):
    """Register a new user after checking if email exists."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    try:
        query = "SELECT email FROM user WHERE email = %s"
        cursor.execute(query, (email,))
        result = cursor.fetchone()
        if result:
            raise Exception("Email already exists")

        password_hash = generate_password_hash(password)
        school_id = generate_school_id(role)

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
    query = "SELECT id, full_name, email, role, password_hash, school_id FROM user WHERE email = %s"
    try:
        cursor.execute(query, (email,))
        result = cursor.fetchone()

        if result and check_password_hash(result[4], password):
            return result
        return None

    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def getUserBySchoolId(school_id):
    """Get user profile by school_id."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT id, school_id, full_name, email, role, phone, date_of_birth
    FROM user
    WHERE school_id = %s
    """
    try:
        cursor.execute(query, (school_id,))
        return cursor.fetchone()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def generate_school_id(role):
    """Generate a unique school ID"""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    if role == "student":
        prefix = "S"
    elif role == "teacher":
        prefix = "T"
    elif role == "admin":
        prefix = "A"
    else:
        raise Exception("Invalid role")

    query = "SELECT COUNT(*) FROM user WHERE role = %s"
    cursor.execute(query, (role,))
    count = cursor.fetchone()[0] + 1
    postfix = f"{count:06d}"
    return f"{prefix}{postfix}"
