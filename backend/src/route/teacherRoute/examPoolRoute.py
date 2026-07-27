from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from database import get_db
from src.a_db_config import (
    AttemptQuestion,
    Chapter,
    ChapterLO,
    Exam,
    ExamPoolConfig,
    ExamPoolQuestion,
    ExamPoolRule,
    ExamQuestion,
    LO,
    Question,
    QuestionSelectionMode,
    User,
)
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token
from src.models.teacher.requestModel.ExamQuestionPoolRequest import PoolConfigRequest
from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
from src.route.teacherRoute.addQuestionsRoute import (
    _clone_question,
    _has_content_changes,
    _replace_options,
    _replace_taxonomy_rows,
    _validate_taxonomy,
)
from src.service.exam_pool_service import (
    distribute_points,
    eligible_question_ids,
    seeded_random,
    select_unique_candidates,
    validate_rule_taxonomy,
)

router = APIRouter()


def _teacher_and_exam(db: Session, exam_id: int, school_id: str) -> tuple[User, Exam]:
    teacher = db.query(User).filter(User.school_id == school_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.manage_by != school_id:
        raise HTTPException(status_code=403, detail="You do not manage this exam")
    return teacher, exam


def _config_query(db: Session, exam_id: int):
    return (
        db.query(ExamPoolConfig)
        .options(
            selectinload(ExamPoolConfig.rules).selectinload(ExamPoolRule.chapter),
            selectinload(ExamPoolConfig.rules).selectinload(ExamPoolRule.lo),
            selectinload(ExamPoolConfig.rules).selectinload(ExamPoolRule.candidates),
        )
        .filter(ExamPoolConfig.exam_id == exam_id)
    )


def _serialize_config(config: ExamPoolConfig, mode: str) -> dict:
    rules = []
    for rule in sorted(config.rules, key=lambda item: item.rule_id):
        rules.append(
            {
                "rule_id": rule.rule_id,
                "chapter_id": rule.chapter_id,
                "chapter_name": rule.chapter.chapter_name if rule.chapter else None,
                "lo_id": rule.lo_id,
                "lo_name": rule.lo.lo_name if rule.lo else None,
                "difficulty": rule.difficulty.value
                if hasattr(rule.difficulty, "value")
                else rule.difficulty,
                "draw_count": rule.draw_count,
                "available_count": len(rule.candidates),
            }
        )
    return {
        "pool_config_id": config.pool_config_id,
        "exam_id": config.exam_id,
        "subject_id": config.subject_id,
        "fixed_randomization": config.fixed_randomization,
        "version": config.version,
        "mode": mode,
        "total_questions": sum(rule["draw_count"] for rule in rules),
        "rules": rules,
    }


@router.get("/exams/{exam_id}/pool-availability")
def get_pool_availability(
    exam_id: int,
    subject_id: str | None = None,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher, exam = _teacher_and_exam(db, exam_id, current_user["school_id"])
    selected_subject = subject_id or exam.subject_id
    if not selected_subject:
        raise HTTPException(status_code=422, detail="Select an exam subject first")
    if exam.subject_id and selected_subject != exam.subject_id:
        raise HTTPException(status_code=422, detail="Pool subject must match the exam subject")

    chapters = (
        db.query(Chapter)
        .options(selectinload(Chapter.chapter_los).selectinload(ChapterLO.lo))
        .filter(Chapter.subject_id == selected_subject)
        .order_by(Chapter.chapter_id)
        .all()
    )
    rows = []
    for chapter in chapters:
        lo_values: list[LO | None] = [None] + [
            association.lo for association in chapter.chapter_los if association.lo
        ]
        for learning_objective in lo_values:
            for difficulty in ("easy", "medium", "hard"):
                question_ids = eligible_question_ids(
                    db,
                    teacher,
                    selected_subject,
                    chapter.chapter_id,
                    learning_objective.lo_id if learning_objective else None,
                    difficulty,
                )
                rows.append(
                    {
                        "subject_id": selected_subject,
                        "chapter_id": chapter.chapter_id,
                        "chapter_name": chapter.chapter_name,
                        "lo_id": learning_objective.lo_id if learning_objective else None,
                        "lo_name": learning_objective.lo_name if learning_objective else None,
                        "difficulty": difficulty,
                        "available_count": len(question_ids),
                    }
                )
    return {"subject_id": selected_subject, "rows": rows}


@router.get("/exams/{exam_id}/pool-config")
def get_pool_config(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _, exam = _teacher_and_exam(db, exam_id, current_user["school_id"])
    config = _config_query(db, exam_id).first()
    if not config:
        return {
            "exam_id": exam_id,
            "mode": exam.question_selection_mode.value
            if hasattr(exam.question_selection_mode, "value")
            else exam.question_selection_mode,
            "config": None,
        }
    mode = (
        exam.question_selection_mode.value
        if hasattr(exam.question_selection_mode, "value")
        else exam.question_selection_mode
    )
    return _serialize_config(config, mode)


@router.put("/exams/{exam_id}/pool-config")
def put_pool_config(
    exam_id: int,
    request: PoolConfigRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        teacher, exam = _teacher_and_exam(db, exam_id, current_user["school_id"])
        if exam.subject_id and request.subject_id != exam.subject_id:
            raise HTTPException(status_code=422, detail="Pool subject must match the exam subject")
        rule_keys = [
            (rule.chapter_id, rule.lo_id, rule.difficulty) for rule in request.rules
        ]
        if len(rule_keys) != len(set(rule_keys)):
            raise HTTPException(status_code=422, detail="Pool contains duplicate rules")

        existing = _config_query(db, exam_id).first()
        version = (existing.version + 1) if existing else 1
        if existing:
            db.delete(existing)
            db.flush()
        config = ExamPoolConfig(
            exam_id=exam_id,
            subject_id=request.subject_id,
            fixed_randomization=request.fixed_randomization,
            version=version,
        )
        db.add(config)
        db.flush()
        candidates_by_rule: dict[int, list[int]] = {}
        draw_counts: dict[int, int] = {}
        for index, requested_rule in enumerate(request.rules):
            validate_rule_taxonomy(
                db,
                request.subject_id,
                requested_rule.chapter_id,
                requested_rule.lo_id,
            )
            candidate_ids = eligible_question_ids(
                db,
                teacher,
                request.subject_id,
                requested_rule.chapter_id,
                requested_rule.lo_id,
                requested_rule.difficulty,
            )
            if requested_rule.draw_count > len(candidate_ids):
                raise HTTPException(
                    status_code=422,
                    detail={
                        "message": "Requested draw count exceeds available questions",
                        "rule_index": index,
                        "draw_count": requested_rule.draw_count,
                        "available_count": len(candidate_ids),
                    },
                )
            rule = ExamPoolRule(
                pool_config_id=config.pool_config_id,
                chapter_id=requested_rule.chapter_id,
                lo_id=requested_rule.lo_id,
                difficulty=requested_rule.difficulty,
                draw_count=requested_rule.draw_count,
            )
            db.add(rule)
            db.flush()
            db.add_all(
                ExamPoolQuestion(rule_id=rule.rule_id, question_id=question_id)
                for question_id in candidate_ids
            )
            candidates_by_rule[rule.rule_id] = candidate_ids
            draw_counts[rule.rule_id] = rule.draw_count

        selected = select_unique_candidates(
            candidates_by_rule,
            draw_counts,
            seeded_random("pool-config", exam_id, version),
        )
        db.query(ExamQuestion).filter(ExamQuestion.exam_id == exam_id).delete(
            synchronize_session=False
        )
        if request.fixed_randomization:
            selected_ids = [
                question_id
                for rule in sorted(selected)
                for question_id in selected[rule]
            ]
            allocation = distribute_points(exam.total_points or 0, selected_ids)
            db.add_all(
                ExamQuestion(
                    exam_id=exam_id,
                    question_id=question_id,
                    question_point=allocation[question_id],
                )
                for question_id in selected_ids
            )
            exam.question_selection_mode = QuestionSelectionMode.fixed_randomization
        else:
            exam.question_selection_mode = QuestionSelectionMode.pool
        db.commit()
        saved = _config_query(db, exam_id).one()
        mode = (
            exam.question_selection_mode.value
            if hasattr(exam.question_selection_mode, "value")
            else exam.question_selection_mode
        )
        return _serialize_config(saved, mode)
    except HTTPException:
        db.rollback()
        raise


@router.delete("/exams/{exam_id}/pool-config", status_code=status.HTTP_200_OK)
def delete_pool_config(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        _, exam = _teacher_and_exam(db, exam_id, current_user["school_id"])
        config = _config_query(db, exam_id).first()
        if config:
            db.delete(config)
        exam.question_selection_mode = QuestionSelectionMode.manual
        db.commit()
        return {"success": True, "mode": "manual"}
    except HTTPException:
        db.rollback()
        raise


@router.get("/exams/{exam_id}/pool-rules/{rule_id}/questions")
def get_pool_rule_questions(
    exam_id: int,
    rule_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _teacher_and_exam(db, exam_id, current_user["school_id"])
    rule = (
        db.query(ExamPoolRule)
        .join(ExamPoolConfig)
        .options(
            selectinload(ExamPoolRule.candidates)
            .selectinload(ExamPoolQuestion.question)
            .selectinload(Question.options),
            selectinload(ExamPoolRule.candidates)
            .selectinload(ExamPoolQuestion.question)
            .selectinload(Question.chapter_questions),
            selectinload(ExamPoolRule.candidates)
            .selectinload(ExamPoolQuestion.question)
            .selectinload(Question.lo_questions),
        )
        .filter(ExamPoolConfig.exam_id == exam_id, ExamPoolRule.rule_id == rule_id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Pool rule not found")
    return {
        "rule_id": rule_id,
        "questions": [
            {
                "question_id": candidate.question.question_id,
                "question_text": candidate.question.question_text,
                "question_type": candidate.question.question_type.value,
                "question_difficulties": candidate.question.question_difficulties.value,
                "subject_id": candidate.question.subject_id,
                "chapter_ids": [item.chapter_id for item in candidate.question.chapter_questions],
                "lo_ids": [item.lo_id for item in candidate.question.lo_questions],
                "question_status": candidate.question.question_status.value,
                "options": [
                    {
                        "options_id": option.options_id,
                        "options_text": option.options_text,
                        "is_correct": option.is_correct,
                    }
                    for option in sorted(candidate.question.options, key=lambda item: item.options_id)
                ],
            }
            for candidate in sorted(rule.candidates, key=lambda item: item.question_id)
        ],
    }


@router.put("/exams/{exam_id}/pool-rules/{rule_id}/questions/{question_id}")
def update_pool_candidate(
    exam_id: int,
    rule_id: int,
    question_id: int,
    request: QuestionUpdateRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        teacher, _ = _teacher_and_exam(db, exam_id, current_user["school_id"])
        config = _config_query(db, exam_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="Pool configuration not found")
        clicked = (
            db.query(ExamPoolQuestion)
            .join(ExamPoolRule)
            .filter(
                ExamPoolRule.pool_config_id == config.pool_config_id,
                ExamPoolRule.rule_id == rule_id,
                ExamPoolQuestion.question_id == question_id,
            )
            .first()
        )
        if not clicked:
            raise HTTPException(status_code=404, detail="Pool candidate not found")
        question = db.get(Question, question_id)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        if not _has_content_changes(question, request):
            return {"success": True, "question_id": question_id, "cloned": False}

        target_subject = request.subject_id or question.subject_id
        chapter_ids = (
            request.chapter_ids
            if request.chapter_ids is not None
            else [item.chapter_id for item in question.chapter_questions]
        )
        lo_ids = (
            request.lo_ids
            if request.lo_ids is not None
            else [item.lo_id for item in question.lo_questions]
        )
        chapters, los = _validate_taxonomy(db, target_subject, chapter_ids, lo_ids)
        target_difficulty = request.question_difficulties or (
            question.question_difficulties.value
            if hasattr(question.question_difficulties, "value")
            else question.question_difficulties
        )
        current_config_rules = (
            db.query(ExamPoolRule)
            .join(ExamPoolQuestion)
            .filter(
                ExamPoolRule.pool_config_id == config.pool_config_id,
                ExamPoolQuestion.question_id == question_id,
            )
            .all()
        )
        chapter_set = set(chapter_ids)
        lo_set = set(lo_ids)
        invalid_rules = [
            rule.rule_id
            for rule in current_config_rules
            if target_subject != config.subject_id
            or rule.chapter_id not in chapter_set
            or (rule.lo_id is not None and rule.lo_id not in lo_set)
            or (
                rule.difficulty.value
                if hasattr(rule.difficulty, "value")
                else rule.difficulty
            )
            != target_difficulty
        ]
        if invalid_rules:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "The edit would make this candidate ineligible for a saved pool rule",
                    "rule_ids": invalid_rules,
                },
            )

        all_pool_config_ids = {
            row[0]
            for row in db.query(ExamPoolRule.pool_config_id)
            .join(ExamPoolQuestion)
            .filter(ExamPoolQuestion.question_id == question_id)
            .distinct()
            .all()
        }
        safe_in_place = (
            question.created_by == teacher.id
            and (
                question.question_status.value
                if hasattr(question.question_status, "value")
                else question.question_status
            )
            == "draft"
            and all_pool_config_ids == {config.pool_config_id}
            and not db.query(ExamQuestion).filter_by(question_id=question_id).first()
            and not db.query(AttemptQuestion).filter_by(question_id=question_id).first()
        )
        if safe_in_place:
            if request.question_text is not None:
                question.question_text = request.question_text.strip()
            if request.question_type is not None:
                question.question_type = request.question_type
            if request.question_difficulties is not None:
                question.question_difficulties = request.question_difficulties
            question.subject_id = target_subject
            _replace_taxonomy_rows(
                db,
                question_id,
                chapters if request.chapter_ids is not None else None,
                los if request.lo_ids is not None else None,
            )
            if request.options is not None:
                _replace_options(db, question, request.options)
            effective = question
        else:
            effective = _clone_question(
                db, question, teacher.id, request, chapters, los
            )
            affected_rule_ids = [rule.rule_id for rule in current_config_rules]
            db.query(ExamPoolQuestion).filter(
                ExamPoolQuestion.rule_id.in_(affected_rule_ids),
                ExamPoolQuestion.question_id == question_id,
            ).delete(synchronize_session=False)
            db.add_all(
                ExamPoolQuestion(rule_id=affected_rule_id, question_id=effective.question_id)
                for affected_rule_id in affected_rule_ids
            )
        db.flush()
        db.expire_all()
        refreshed_rules = _config_query(db, exam_id).one().rules
        select_unique_candidates(
            {
                rule.rule_id: [candidate.question_id for candidate in rule.candidates]
                for rule in refreshed_rules
            },
            {rule.rule_id: rule.draw_count for rule in refreshed_rules},
            seeded_random("pool-revalidate", exam_id, config.version),
        )
        db.commit()
        return {
            "success": True,
            "question_id": effective.question_id,
            "cloned": not safe_in_place,
            "source_question_id": question_id if not safe_in_place else question.source_question_id,
        }
    except HTTPException:
        db.rollback()
        raise


@router.post("/exams/{exam_id}/pool-config/exit")
def exit_pool_mode(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        _, exam = _teacher_and_exam(db, exam_id, current_user["school_id"])
        config = _config_query(db, exam_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="Pool configuration not found")
        candidate_ids = sorted(
            {
                candidate.question_id
                for rule in config.rules
                for candidate in rule.candidates
            }
        )
        allocation = distribute_points(exam.total_points or 0, candidate_ids)
        db.query(ExamQuestion).filter(ExamQuestion.exam_id == exam_id).delete(
            synchronize_session=False
        )
        db.add_all(
            ExamQuestion(
                exam_id=exam_id,
                question_id=question_id,
                question_point=allocation[question_id],
            )
            for question_id in candidate_ids
        )
        db.delete(config)
        exam.question_selection_mode = QuestionSelectionMode.manual
        db.commit()
        return {
            "success": True,
            "mode": "manual",
            "materialized_count": len(candidate_ids),
            "question_ids": candidate_ids,
        }
    except HTTPException:
        db.rollback()
        raise
