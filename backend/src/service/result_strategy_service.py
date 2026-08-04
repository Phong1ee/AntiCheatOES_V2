from __future__ import annotations

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from src.a_db_config import Attempt, AttemptStatus, EssayAnswer, Exam, ExamSetting, ResultStrategy, StudentExam
from src.service.scoring_service import SCORE_QUANTUM


def submitted_attempts_by_student(db: Session, exam_id: int) -> dict[str, list[Attempt]]:
    attempts = (
        db.query(Attempt)
        .filter(
            Attempt.exam_id == exam_id,
            Attempt.submitted_at.isnot(None),
            Attempt.status.in_([AttemptStatus.submitted, AttemptStatus.terminated]),
            Attempt.score_scale_version == 2,
        )
        .order_by(Attempt.attempt_no, Attempt.submitted_at, Attempt.attempt_id)
        .all()
    )
    pending_attempt_ids = {
        attempt_id
        for attempt_id, answer_text in db.query(EssayAnswer.attempt_id, EssayAnswer.answer_text)
        .join(Attempt, Attempt.attempt_id == EssayAnswer.attempt_id)
        .filter(Attempt.exam_id == exam_id)
        .filter(EssayAnswer.score.is_(None))
        .all()
        if answer_text and answer_text.strip()
    }
    by_student: dict[str, list[Attempt]] = {}
    for attempt in attempts:
        if attempt.attempt_id in pending_attempt_ids:
            continue
        if attempt.student_id is not None:
            by_student.setdefault(attempt.student_id, []).append(attempt)
    return by_student


def _attempt_order(attempt: Attempt) -> tuple[int, datetime, int]:
    return (
        attempt.attempt_no or 0,
        attempt.submitted_at or datetime.min,
        attempt.attempt_id or 0,
    )


def best_attempt(attempts: list[Attempt]) -> Attempt | None:
    if not attempts:
        return None
    return max(
        attempts,
        key=lambda attempt: (
            attempt.score if attempt.score is not None else Decimal("-1"),
            *_attempt_order(attempt),
        ),
    )


def latest_attempt(attempts: list[Attempt]) -> Attempt | None:
    return max(attempts, key=_attempt_order) if attempts else None


def representative_attempt(strategy: str, attempts: list[Attempt]) -> Attempt | None:
    if strategy == ResultStrategy.last_attempt.value:
        return latest_attempt(attempts)
    return best_attempt(attempts)


def compute_final_score(strategy: str, attempts: list[Attempt]) -> Decimal | None:
    if not attempts:
        return None
    if strategy == ResultStrategy.average.value:
        scored = [attempt.score for attempt in attempts if attempt.score is not None]
        return (
            (sum(scored, Decimal("0")) / len(scored)).quantize(SCORE_QUANTUM, rounding=ROUND_HALF_UP)
            if scored
            else None
        )
    if strategy == ResultStrategy.last_attempt.value:
        latest = latest_attempt(attempts)
        return latest.score if latest else None
    best = best_attempt(attempts)
    return best.score if best else None


def get_or_create_exam_settings(db: Session, exam_id: int) -> ExamSetting:
    settings = db.get(ExamSetting, exam_id)
    if settings is None:
        settings = ExamSetting(exam_id=exam_id, result_strategy=ResultStrategy.highest)
        db.add(settings)
        db.flush()
    return settings


def sync_final_scores(db: Session, exam: Exam) -> str:
    settings = get_or_create_exam_settings(db, exam.exam_id)
    strategy = settings.result_strategy.value
    submitted = submitted_attempts_by_student(db, exam.exam_id)
    student_exams = db.query(StudentExam).filter(StudentExam.exam_id == exam.exam_id).all()
    for student_exam in student_exams:
        student_exam.final_score = compute_final_score(
            strategy,
            submitted.get(student_exam.student_id, []),
        )
    db.flush()
    return strategy


def set_result_strategy(db: Session, exam: Exam, strategy: ResultStrategy) -> str:
    settings = get_or_create_exam_settings(db, exam.exam_id)
    settings.result_strategy = strategy
    db.flush()
    return sync_final_scores(db, exam)


def sync_student_final_score(db: Session, exam: Exam, student_id: str) -> Decimal | None:
    settings = get_or_create_exam_settings(db, exam.exam_id)
    attempts = submitted_attempts_by_student(db, exam.exam_id).get(student_id, [])
    student_exam = db.get(StudentExam, (student_id, exam.exam_id))
    if student_exam is None:
        return None
    student_exam.final_score = compute_final_score(settings.result_strategy.value, attempts)
    db.flush()
    return student_exam.final_score
