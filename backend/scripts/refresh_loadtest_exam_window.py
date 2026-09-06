"""Open the single disposable Railway load-test exam for a bounded window."""

from datetime import datetime, timedelta
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from src.a_db_config import Exam, ExamStatus


LOAD_SUBJECT_ID = "LOAD101"
LOAD_EXAM_TITLE = "Disposable authenticated load exam"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh the disposable load-test exam schedule")
    parser.add_argument("--hours", type=int, default=6)
    args = parser.parse_args()
    if args.hours < 1 or args.hours > 24:
        parser.error("--hours must be between 1 and 24")
    return args


def main() -> None:
    args = parse_args()
    db = SessionLocal()
    try:
        exams = db.query(Exam).filter(
            Exam.subject_id == LOAD_SUBJECT_ID,
            Exam.title == LOAD_EXAM_TITLE,
        ).all()
        if len(exams) != 1:
            raise RuntimeError("Expected exactly one disposable LOAD101 exam")

        now = datetime.now()
        exam = exams[0]
        exam.status = ExamStatus.published
        exam.start_time = now - timedelta(minutes=5)
        exam.end_time = now + timedelta(hours=args.hours)
        db.commit()
        print(f"Refreshed disposable exam window for {args.hours} hours.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
