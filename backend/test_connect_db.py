import os
from dotenv import load_dotenv
import mysql.connector

load_dotenv()

conn = mysql.connector.connect(
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "online_exam_db")
)

cursor = conn.cursor()
cursor.execute("SELECT DATABASE()")
print("Connected to database:", cursor.fetchone()[0])

cursor.close()
conn.close()