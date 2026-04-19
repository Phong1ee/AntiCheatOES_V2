import os
from dotenv import load_dotenv
import mysql.connector

load_dotenv()

def get_db_connection():
    cnx = mysql.connector.connect(
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'online_exam_db')
    )
    return cnx
    


''