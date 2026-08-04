"""Repair blank essays and recompute completed attempt/result scores.

Run from the backend directory. This command is dry-run by default; use
``--apply`` only after confirming the target database is safe to modify.
"""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import selectinload

from database import SessionLocal
from src.a_db_config import Attempt, AttemptQuestion, EssayAnswer, Exam, MCQAnswer
from src.service.result_strategy_service import sync_student_final_score


def _question_type(link: AttemptQuestion) -> str:
    value = link.question_type_snapshot or link.question.question_type
    return str(getattr(value, "value", value)).lower()


def _snapshot_option_is_correct(link: AttemptQuestion, selected_option_id: int | None) -> bool:
    if selected_option_id is None:
        return False
    snapshot = link.options_snapshot
    if snapshot is not None:
        options = json.loads(snapshot) if isinstance(snapshot, str) else snapshot
        return any(
            int(option["id"]) == int(selected_option_id) and bool(option.get("isCorrect"))
            for option in options or []
        )
    answer = link.mcq_answer
    return bool(answer and answer.selected_option and answer.selected_option.is_correct)


def _attempt_score(links: list[AttemptQuestion]) -> Decimal:
    total = Decimal("0.00")
    for link in links:
        if _question_type(link) == "essay":
            if link.essay_answer and link.essay_answer.score is not None:
                total += Decimal(str(link.essay_answer.score))
            continue
        selected_id = link.mcq_answer.selected_option_id if link.mcq_answer else None
        if _snapshot_option_is_correct(link, selected_id):
            points = link.question_point_snapshot
            total += Decimal(str(points if points is not None else link.question_point or 0))
    return total


def recompute(apply: bool) -> dict[str, int]:
    db = SessionLocal()
    counts = {"blank_essays": 0, "attempt_scores": 0, "final_scores": 0}
    affected_students: set[tuple[int, str]] = set()
    try:
        attempts = (
            db.query(Attempt)
            .filter(Attempt.status.in_(["submitted", "terminated"]))
            .options(
                selectinload(Attempt.attempt_questions).selectinload(AttemptQuestion.question),
                selectinload(Attempt.attempt_questions).selectinload(AttemptQuestion.essay_answer),
                selectinload(Attempt.attempt_questions)
                .selectinload(AttemptQuestion.mcq_answer)
                .selectinload(MCQAnswer.selected_option),
            )
            .all()
        )
        for attempt in attempts:
            links = attempt.attempt_questions
            for link in links:
                if _question_type(link) != "essay":
                    continue
                essay = link.essay_answer
                blank = essay is None or not str(essay.answer_text or "").strip()
                if blank and (essay is None or essay.score is None or essay.answer_text != ""):
                    counts["blank_essays"] += 1
                    if apply:
                        if essay is None:
                            db.add(EssayAnswer(
                                attempt_id=attempt.attempt_id,
                                question_id=link.question_id,
                                answer_text="",
                                score=0,
                            ))
                        elif essay.score is None:
                            essay.answer_text = ""
                            essay.score = 0
                        else:
                            # Preserve a Teacher-entered score even for malformed legacy text.
                            essay.answer_text = ""

            if apply:
                db.flush()
            desired_score = _attempt_score(links)
            current_score = Decimal(str(attempt.score or 0))
            if current_score != desired_score:
                counts["attempt_scores"] += 1
                if apply:
                    attempt.score = desired_score
            if attempt.student_id is not None:
                affected_students.add((attempt.exam_id, attempt.student_id))

        counts["final_scores"] = len(affected_students)
        if apply:
            db.flush()
            for exam_id, student_id in affected_students:
                exam = db.get(Exam, exam_id)
                if exam is not None:
                    sync_student_final_score(db, exam, student_id)
            db.commit()
        else:
            db.rollback()
        return counts
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Recompute completed exam result scores safely.")
    parser.add_argument("--apply", action="store_true", help="Persist repairs instead of dry-run.")
    args = parser.parse_args()
    counts = recompute(args.apply)
    mode = "updated" if args.apply else "would update"
    print(
        f"{mode}: {counts['blank_essays']} blank essay rows, "
        f"{counts['attempt_scores']} attempt scores, "
        f"{counts['final_scores']} student final scores"
    )


if __name__ == "__main__":
    main()
