from src.a_db_config.config import get_db_connection
from werkzeug.security import check_password_hash, generate_password_hash


def getProfileBySchoolId(school_id: str):
    """Get one user profile by school_id."""
    cnx = get_db_connection()
    cursor = cnx.cursor(dictionary=True)
    query = """
    SELECT id, school_id, full_name, email, role, phone, date_of_birth
    FROM user
    WHERE school_id = %s
    LIMIT 1
    """
    try:
        cursor.execute(query, (school_id,))
        return cursor.fetchone()
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def updateProfileBySchoolId(school_id: str, full_name: str, phone: str | None, date_of_birth):
    """Update editable profile fields for a user."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    UPDATE user
    SET full_name = %s,
        phone = %s,
        date_of_birth = %s
    WHERE school_id = %s
    """
    try:
        cursor.execute(query, (full_name, phone, date_of_birth, school_id))
        cnx.commit()
        return cursor.rowcount
    except Exception as e:
        cnx.rollback()
        raise e
    finally:
        cursor.close()
        cnx.close()


def getPasswordHashBySchoolId(school_id: str):
    """Get current password hash by school_id."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    SELECT password_hash
    FROM user
    WHERE school_id = %s
    LIMIT 1
    """
    try:
        cursor.execute(query, (school_id,))
        result = cursor.fetchone()
        return result[0] if result else None
    except Exception as e:
        raise e
    finally:
        cursor.close()
        cnx.close()


def verifyCurrentPassword(school_id: str, current_password: str):
    """Verify current password using the existing werkzeug hash mechanism."""
    password_hash = getPasswordHashBySchoolId(school_id)
    if not password_hash:
        return False
    return check_password_hash(password_hash, current_password)


def updatePasswordBySchoolId(school_id: str, new_password: str):
    """Update password_hash using the same hash mechanism as register."""
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = """
    UPDATE user
    SET password_hash = %s
    WHERE school_id = %s
    """
    try:
        new_password_hash = generate_password_hash(new_password)
        cursor.execute(query, (new_password_hash, school_id))
        cnx.commit()
        return cursor.rowcount
    except Exception as e:
        cnx.rollback()
        raise e
    finally:
        cursor.close()
        cnx.close()
