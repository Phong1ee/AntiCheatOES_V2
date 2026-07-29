from __future__ import annotations

import hashlib
import random
from decimal import Decimal, ROUND_DOWN
from typing import Iterable, Mapping, Sequence

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from src.a_db_config import (
    Chapter,
    ChapterLO,
    ChapterQuestion,
    Exam,
    ExamPoolQuestion,
    ExamPoolRule,
    LO,
    LOQuestion,
    Question,
    QuestionStatus,
    User,
)


POINT_QUANTUM = Decimal("0.01")


def distribute_points(total_points: Decimal | int, question_ids: Sequence[int]) -> dict[int, Decimal]:
    if not question_ids:
        raise HTTPException(status_code=422, detail="At least one question is required")
    total = Decimal(str(total_points)).quantize(POINT_QUANTUM)
    if total <= 0:
        raise HTTPException(status_code=422, detail="Exam total points must be positive")
    base = (total / len(question_ids)).quantize(POINT_QUANTUM, rounding=ROUND_DOWN)
    if base <= 0:
        raise HTTPException(
            status_code=422,
            detail="Exam total points is too small to assign a positive value to every question",
        )
    points = {question_id: base for question_id in question_ids}
    points[question_ids[-1]] += total - (base * len(question_ids))
    return points


def seeded_random(*parts: object) -> random.Random:
    digest = hashlib.sha256(":".join(str(part) for part in parts).encode("utf-8")).digest()
    return random.Random(int.from_bytes(digest[:16], "big"))


def select_unique_candidates(
    candidates: Mapping[int, Sequence[int]],
    draw_counts: Mapping[int, int],
    rng: random.Random,
) -> dict[int, list[int]]:
    """Find a unique assignment across overlapping rules using bipartite matching."""
    ordered_rules = sorted(
        candidates,
        key=lambda rule_id: (len(set(candidates[rule_id])) - draw_counts[rule_id], rule_id),
    )
    shuffled = {}
    for rule_id in ordered_rules:
        values = sorted(set(candidates[rule_id]))
        rng.shuffle(values)
        shuffled[rule_id] = values

    slots = [
        rule_id
        for rule_id in ordered_rules
        for _ in range(draw_counts[rule_id])
    ]
    matched_question_to_slot: dict[int, int] = {}

    def augment(slot_index: int, seen_questions: set[int]) -> bool:
        rule_id = slots[slot_index]
        for question_id in shuffled[rule_id]:
            if question_id in seen_questions:
                continue
            seen_questions.add(question_id)
            previous_slot = matched_question_to_slot.get(question_id)
            if previous_slot is None or augment(previous_slot, seen_questions):
                matched_question_to_slot[question_id] = slot_index
                return True
        return False

    for slot_index in range(len(slots)):
        if not augment(slot_index, set()):
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Pool rules overlap and cannot be satisfied without duplicate questions",
                    "rules": ordered_rules,
                },
            )

    result = {rule_id: [] for rule_id in ordered_rules}
    for question_id, slot_index in matched_question_to_slot.items():
        result[slots[slot_index]].append(question_id)
    for values in result.values():
        values.sort()
    return result


def authorized_question_filter(teacher: User):
    return or_(
        Question.question_status == QuestionStatus.approved,
        and_(
            Question.created_by == teacher.school_id,
            Question.question_status.in_([QuestionStatus.draft, QuestionStatus.pending]),
        ),
    )


def validate_rule_taxonomy(
    db: Session,
    subject_id: str,
    chapter_id: int,
    lo_id: int | None,
) -> tuple[Chapter, LO | None]:
    chapter = db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=422, detail=f"Chapter {chapter_id} was not found")
    if chapter.subject_id != subject_id:
        raise HTTPException(
            status_code=422,
            detail=f"Chapter {chapter_id} does not belong to subject {subject_id}",
        )
    if lo_id is None:
        return chapter, None
    learning_objective = db.get(LO, lo_id)
    if not learning_objective:
        raise HTTPException(status_code=422, detail=f"Learning objective {lo_id} was not found")
    if not db.query(ChapterLO).filter_by(chapter_id=chapter_id, lo_id=lo_id).first():
        raise HTTPException(
            status_code=422,
            detail=f"Learning objective {lo_id} does not belong to chapter {chapter_id}",
        )
    return chapter, learning_objective


def eligible_question_ids(
    db: Session,
    teacher: User,
    subject_id: str,
    chapter_id: int,
    lo_id: int | None,
    difficulty: str,
) -> list[int]:
    query = (
        db.query(Question.question_id)
        .join(ChapterQuestion, ChapterQuestion.question_id == Question.question_id)
        .filter(
            Question.subject_id == subject_id,
            Question.question_difficulties == difficulty,
            ChapterQuestion.chapter_id == chapter_id,
            authorized_question_filter(teacher),
        )
    )
    if lo_id is not None:
        query = query.join(
            LOQuestion,
            and_(
                LOQuestion.question_id == Question.question_id,
                LOQuestion.lo_id == lo_id,
            ),
        )
    return [row[0] for row in query.distinct().order_by(Question.question_id).all()]


def saved_rule_candidates(config_rules: Iterable[ExamPoolRule]) -> dict[int, list[int]]:
    return {
        rule.rule_id: [candidate.question_id for candidate in rule.candidates]
        for rule in config_rules
    }


def ensure_pool_satisfiable(config_rules: Sequence[ExamPoolRule], seed: object = "validation") -> None:
    select_unique_candidates(
        saved_rule_candidates(config_rules),
        {rule.rule_id: rule.draw_count for rule in config_rules},
        seeded_random(seed),
    )
