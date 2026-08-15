import os

from dotenv import load_dotenv
import mysql.connector


def check_connection():
    load_dotenv()

    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "online_exam_db"),
    )

    try:
        cursor = conn.cursor()

        cursor.execute("SELECT DATABASE()")
        database_name = cursor.fetchone()[0]

        print("Connected to database:", database_name)

    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    check_connection()
