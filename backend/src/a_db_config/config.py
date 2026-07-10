import os
from dotenv import load_dotenv
import mysql.connector

load_dotenv()

def get_db_connection():
    try:
        cnx = mysql.connector.connect(
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', '12345'),
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME', 'online_exam_db')
        )
        if not cnx.is_connected():
            raise mysql.connector.Error('Unable to establish database connection')
        return cnx
    except mysql.connector.Error as err:
        print(f'Error connecting to database: {err}')
        raise

