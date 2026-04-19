from src.db_config.config import get_db_connection

async def insert_user(username, email, password, role):
    cnx = get_db_connection()
    cursor = cnx.cursor()
    query = "INSERT INTO users (username, email, password, role) VALUES (%s, %s, %s, %s)"
    cursor.execute(query, (username, email, password, role))
    cnx.commit()
    cursor.close()
    cnx.close()