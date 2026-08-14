import io
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from database import get_db
from src.a_db_config import (
    Attempt,
    AttemptQuestion,
    BackgroundJobStatus,
    Exam,
    ExamQuestion,
    ExamPoolConfig,
    ExamPoolRule,
    ExamSetting,
    ExamStatus,
    EssayAnswer,
    MCQAnswer,
    Option,
    Question,
    QuestionType,
    ResultStrategy,
    StudentExam,
    User,
)
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token
from src.route.teacherRoute.getExamsRoute import _owned_exam, _teacher, get_exam_status
from src.service.result_strategy_service import (
    get_or_create_exam_settings as _get_or_create_settings_by_id,
    representative_attempt as _representative_attempt,
    set_result_strategy,
    submitted_attempts_by_student as _submitted_attempts_by_student,
    sync_final_scores,
    sync_student_final_score,
)
from src.service.scoring_service import (
    GRADING_SCALE,
    decimal_score,
    normalize_score,
    validate_awarded_score,
    validate_max_score,
)
from src.service.audit_service import record_audit
from src.service.cache_invalidation_contract import deliver_invalidation, teacher_grading_finalized
from src.service.outbox_publisher import enqueue_outbox_event
from src.service.report_job_service import (
    REPORT_TYPE_EXAM_RESULTS,
    report_artifact_bytes,
    report_job_summary,
    request_exam_results_report,
)

router = APIRouter()

_SCHEDULE_STATUS_MAP = {"upcoming": "scheduled", "ongoing": "in-progress", "completed": "completed"}


class GradeEssayRequest(BaseModel):
    score: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class UpdateStrategyRequest(BaseModel):
    strategy: ResultStrategy


class CreateReportJobRequest(BaseModel):
    request_id: str = Field(alias="requestId", min_length=1, max_length=64)


def _score_value(value):
    if value is None:
        return 0
    return round(float(value), 2)


def _max_score(link: AttemptQuestion) -> Decimal:
    return validate_max_score(
        link.question_point_snapshot
        if link.question_point_snapshot is not None
        else link.question_point
    )


def _question_type_value(link: AttemptQuestion) -> str:
    value = link.question_type_snapshot or link.question.question_type
    return value.value if hasattr(value, "value") else str(value)


def _snapshot_option(link: AttemptQuestion, option_id: int | None):
    if option_id is None:
        return None
    if link.options_snapshot is not None:
        return next(
            (item for item in link.options_snapshot if int(item["id"]) == int(option_id)),
            None,
        )
    return next(
        (item for item in link.question.options if item.options_id == option_id),
        None,
    )


def _option_is_correct(option) -> bool:
    if option is None:
        return False
    if isinstance(option, dict):
        return bool(option.get("isCorrect"))
    return bool(option.is_correct)


def _attempt_raw_totals(db: Session, attempt_id: int) -> tuple[Decimal, Decimal]:
    links = (
        db.query(AttemptQuestion)
        .options(selectinload(AttemptQuestion.question).selectinload(Question.options))
        .filter(AttemptQuestion.attempt_id == attempt_id)
        .all()
    )
    mcq_by_question = {
        answer.question_id: answer
        for answer in db.query(MCQAnswer).filter(MCQAnswer.attempt_id == attempt_id).all()
    }
    essay_by_question = {
        answer.question_id: answer
        for answer in db.query(EssayAnswer).filter(EssayAnswer.attempt_id == attempt_id).all()
    }
    raw_earned = Decimal("0")
    raw_possible = Decimal("0")
    for link in links:
        maximum = _max_score(link)
        raw_possible += maximum
        question_type = _question_type_value(link)
        if question_type == QuestionType.essay.value:
            essay = essay_by_question.get(link.question_id)
            if essay and essay.score is not None:
                raw_earned += decimal_score(essay.score, field_name="essay score")
            continue
        answer = mcq_by_question.get(link.question_id)
        selected = _snapshot_option(link, answer.selected_option_id if answer else None)
        if _option_is_correct(selected):
            raw_earned += maximum
    return raw_earned, raw_possible


def _time_taken(start_time, end_time, submitted_at):
    finish_time = end_time or submitted_at
    if not start_time or not finish_time:
        return "-"
    total_seconds = max(int((finish_time - start_time).total_seconds()), 0)
    minutes, seconds = divmod(total_seconds, 60)
    if minutes <= 0:
        return f"{seconds}s"
    if seconds == 0:
        return f"{minutes}m"
    return f"{minutes}m {seconds}s"


def _get_or_create_settings(db: Session, exam: Exam) -> ExamSetting:
    return _get_or_create_settings_by_id(db, exam.exam_id)


def _sync_final_scores(db: Session, exam: Exam) -> str:
    """Recompute and persist every roster student's final_score using the exam's current strategy.

    Returns the strategy used, so callers can also pick the matching representative attempt.
    """
    strategy = sync_final_scores(db, exam)
    db.commit()
    return strategy


def _attempt_breakdown(db: Session, attempt_id: int):
    links = (
        db.query(AttemptQuestion)
        .options(selectinload(AttemptQuestion.question).selectinload(Question.options))
        .filter(AttemptQuestion.attempt_id == attempt_id)
        .all()
    )
    answers = {
        answer.question_id: answer
        for answer in db.query(MCQAnswer).filter(MCQAnswer.attempt_id == attempt_id).all()
    }
    correct = sum(
        1
        for link in links
        if _option_is_correct(
            _snapshot_option(
                link,
                answers[link.question_id].selected_option_id if link.question_id in answers else None,
            )
        )
    )
    return correct, len(links)


def _attempt_status(attempt, exam: Exam, essay_pending: bool = False) -> str:
    if essay_pending:
        return "pending-grading"
    if exam.end_time and attempt.submitted_at and attempt.submitted_at > exam.end_time:
        return "late"
    return "submitted"


def _essay_counts(db: Session, attempt_ids: list):
    if not attempt_ids:
        return 0, 0
    rows = db.query(EssayAnswer.answer_text, EssayAnswer.score).filter(EssayAnswer.attempt_id.in_(attempt_ids)).all()
    total = len(rows)
    pending = sum(1 for answer_text, score in rows if score is None and answer_text and answer_text.strip())
    return total, pending


def _all_submitted_attempts_by_student(db: Session, exam_id: int) -> dict[str, list[Attempt]]:
    attempts = (
        db.query(Attempt)
        .filter(
            Attempt.exam_id == exam_id,
            Attempt.submitted_at.isnot(None),
            Attempt.status.in_(["submitted", "terminated"]),
            Attempt.score_scale_version == 3,
        )
        .order_by(Attempt.attempt_no, Attempt.submitted_at, Attempt.attempt_id)
        .all()
    )
    grouped: dict[str, list[Attempt]] = {}
    for attempt in attempts:
        if attempt.student_id:
            grouped.setdefault(attempt.student_id, []).append(attempt)
    return grouped


def _has_essay_questions(db: Session, exam_id: int) -> bool:
    return (
        db.query(ExamQuestion)
        .join(Question, Question.question_id == ExamQuestion.question_id)
        .filter(ExamQuestion.exam_id == exam_id, Question.question_type == QuestionType.essay)
        .first()
        is not None
    )


def _exam_stats(db: Session, exam: Exam) -> dict:
    strategy = _sync_final_scores(db, exam)
    roster = (
        db.query(StudentExam, User)
        .join(User, User.school_id == StudentExam.student_id)
        .filter(StudentExam.exam_id == exam.exam_id)
        .all()
    )
    submitted_by_student = _submitted_attempts_by_student(db, exam.exam_id)
    all_submitted_by_student = _all_submitted_attempts_by_student(db, exam.exam_id)
    scores = []
    submitted_count = 0
    for student_exam, user in roster:
        if all_submitted_by_student.get(user.school_id):
            submitted_count += 1
            if student_exam.final_score is not None:
                scores.append(float(student_exam.final_score))

    selection_mode = (
        exam.question_selection_mode.value
        if hasattr(exam.question_selection_mode, "value")
        else str(exam.question_selection_mode or "manual")
    )
    if selection_mode == "pool":
        total_questions = (
            db.query(func.coalesce(func.sum(ExamPoolRule.draw_count), 0))
            .join(ExamPoolConfig, ExamPoolConfig.pool_config_id == ExamPoolRule.pool_config_id)
            .filter(ExamPoolConfig.exam_id == exam.exam_id)
            .scalar()
            or 0
        )
    else:
        total_questions = (
            db.query(func.count(ExamQuestion.question_id))
            .filter(ExamQuestion.exam_id == exam.exam_id)
            .scalar()
            or 0
        )
    # Essay counts span every submitted attempt (not just each student's final attempt) so a teacher
    # can grade essays from any attempt, since grading can itself change the computed final score.
    all_submitted_ids = [attempt.attempt_id for attempts in all_submitted_by_student.values() for attempt in attempts]
    total_essay, pending_essay = _essay_counts(db, all_submitted_ids)

    return {
        "totalStudents": len(roster),
        "submittedCount": submitted_count,
        "avgScore": round(sum(scores) / len(scores), 2) if scores else 0,
        "highestScore": max(scores) if scores else 0,
        "lowestScore": min(scores) if scores else 0,
        "totalQuestions": total_questions,
        "hasEssayQuestions": total_essay > 0 or _has_essay_questions(db, exam.exam_id),
        "pendingEssayCount": pending_essay,
        "totalEssayCount": total_essay,
        "resultStrategy": strategy,
        "gradingScale": float(GRADING_SCALE),
        "passingScore": _score_value(exam.passing_score),
    }


def _build_student_rows(db: Session, exam: Exam) -> list:
    strategy = _sync_final_scores(db, exam)
    roster = (
        db.query(StudentExam, User)
        .join(User, User.school_id == StudentExam.student_id)
        .filter(StudentExam.exam_id == exam.exam_id)
        .order_by(User.full_name)
        .all()
    )
    submitted_by_student = _submitted_attempts_by_student(db, exam.exam_id)
    all_submitted_by_student = _all_submitted_attempts_by_student(db, exam.exam_id)
    rows = []
    for student_exam, user in roster:
        finalized_attempts = submitted_by_student.get(user.school_id, [])
        attempts_list = all_submitted_by_student.get(user.school_id, [])

        attempt_summaries = []
        for attempt in attempts_list:
            correct, total_questions = _attempt_breakdown(db, attempt.attempt_id)
            _, pending_count = _essay_counts(db, [attempt.attempt_id])
            attempt_summaries.append({
                "attemptId": attempt.attempt_id,
                "attemptNumber": attempt.attempt_no,
                "score": _score_value(attempt.score),
                "gradingScale": float(GRADING_SCALE),
                "correctAnswers": correct,
                "totalQuestions": total_questions,
                "timeSpent": _time_taken(attempt.start_time, attempt.end_time, attempt.submitted_at),
                "status": _attempt_status(attempt, exam, pending_count > 0),
                "provisional": pending_count > 0,
                "submittedAt": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            })

        representative = _representative_attempt(strategy, finalized_attempts)
        display_attempt = representative or (attempts_list[-1] if attempts_list else None)
        representative_summary = (
            next(s for s in attempt_summaries if s["attemptId"] == display_attempt.attempt_id)
            if display_attempt
            else None
        )

        rows.append({
            "id": str(display_attempt.attempt_id) if display_attempt else user.school_id,
            "attemptId": display_attempt.attempt_id if display_attempt else None,
            "studentId": user.school_id,
            "name": user.full_name,
            "score": _score_value(student_exam.final_score) if representative else 0,
            "provisional": bool(display_attempt and not representative),
            "passed": (
                student_exam.final_score >= exam.passing_score
                if representative
                and student_exam.final_score is not None
                and exam.passing_score is not None
                else None
            ),
            "gradingScale": float(GRADING_SCALE),
            "passingScore": _score_value(exam.passing_score),
            "correctAnswers": representative_summary["correctAnswers"] if representative_summary else 0,
            "totalQuestions": representative_summary["totalQuestions"] if representative_summary else 0,
            "timeSpent": representative_summary["timeSpent"] if representative_summary else "-",
            "status": representative_summary["status"] if representative_summary else "not-submitted",
            "submittedAt": representative_summary["submittedAt"] if representative_summary else None,
            "attempts": attempt_summaries,
        })
    return rows


def _build_question_stats(db: Session, exam: Exam) -> list:
    # One data point per student using the strategy's representative, finalized
    # attempt. Pool statistics therefore include only questions actually drawn.
    strategy = _get_or_create_settings(db, exam).result_strategy.value
    submitted_by_student = _submitted_attempts_by_student(db, exam.exam_id)
    submitted_attempt_ids = [
        representative.attempt_id
        for attempts in submitted_by_student.values()
        if (representative := _representative_attempt(strategy, attempts)) is not None
    ]
    if not submitted_attempt_ids:
        return []

    links = (
        db.query(AttemptQuestion)
        .options(selectinload(AttemptQuestion.question).selectinload(Question.options))
        .filter(AttemptQuestion.attempt_id.in_(submitted_attempt_ids))
        .order_by(AttemptQuestion.question_id, AttemptQuestion.attempt_id)
        .all()
    )
    mcq_answers = {
        (answer.attempt_id, answer.question_id): answer
        for answer in db.query(MCQAnswer).filter(MCQAnswer.attempt_id.in_(submitted_attempt_ids)).all()
    }
    essay_answers = {
        (answer.attempt_id, answer.question_id): answer
        for answer in db.query(EssayAnswer).filter(EssayAnswer.attempt_id.in_(submitted_attempt_ids)).all()
    }
    links_by_question: dict[int, list[AttemptQuestion]] = {}
    for link in links:
        links_by_question.setdefault(link.question_id, []).append(link)

    stats = []
    for index, question_links in enumerate(links_by_question.values(), start=1):
        first_link = question_links[0]
        question = first_link.question
        question_type = _question_type_value(first_link)
        question_text = first_link.question_text_snapshot or question.question_text

        if question_type == QuestionType.essay.value:
            graded_ratios = []
            essay_count = 0
            for link in question_links:
                essay = essay_answers.get((link.attempt_id, link.question_id))
                if essay is None:
                    continue
                essay_count += 1
                if essay.score is not None:
                    graded_ratios.append(
                        decimal_score(essay.score, field_name="essay score") / _max_score(link)
                    )
            correct_rate = (
                round(float(sum(graded_ratios, Decimal("0")) / len(graded_ratios) * 100), 1)
                if graded_ratios
                else 0
            )
            stats.append({
                "questionNumber": index,
                "questionText": question_text,
                "type": "essay",
                "difficulty": question.question_difficulties.value if question.question_difficulties else "medium",
                "correctRate": correct_rate,
                "totalAttempts": essay_count,
                "correctOption": None,
                "optionStats": None,
            })
            continue

        total_attempts = len(question_links)
        correct_count = 0
        is_true_false = question_type == QuestionType.true_false.value
        first_options = first_link.options_snapshot if first_link.options_snapshot is not None else question.options
        option_meta = []
        for option_index, option in enumerate(first_options):
            label = option.get("text") if isinstance(option, dict) else option.options_text
            option_meta.append({
                "letter": label if is_true_false else chr(65 + option_index),
                "label": label,
                "isCorrect": _option_is_correct(option),
                "count": 0,
            })
        for link in question_links:
            answer = mcq_answers.get((link.attempt_id, link.question_id))
            selected = _snapshot_option(link, answer.selected_option_id if answer else None)
            if _option_is_correct(selected):
                correct_count += 1
            selected_label = (
                selected.get("text") if isinstance(selected, dict) else selected.options_text
            ) if selected is not None else None
            matching = next((item for item in option_meta if item["label"] == selected_label), None)
            if matching:
                matching["count"] += 1
        option_stats = [
            {
                "option": info["letter"],
                "label": info["label"],
                "isCorrect": info["isCorrect"],
                "percentage": round(info["count"] / total_attempts * 100, 1) if total_attempts else 0,
            }
            for info in option_meta
        ]
        correct_option = next((info["letter"] for info in option_meta if info["isCorrect"]), None)
        stats.append({
            "questionNumber": index,
            "questionText": question_text,
            "type": "true-false" if is_true_false else "mcq",
            "difficulty": question.question_difficulties.value if question.question_difficulties else "medium",
            "correctRate": round(correct_count / total_attempts * 100, 1) if total_attempts else 0,
            "totalAttempts": total_attempts,
            "correctOption": correct_option,
            "optionStats": option_stats,
        })
    return stats


def _recompute_attempt_score(db: Session, attempt_id: int) -> Attempt:
    raw_earned, raw_possible = _attempt_raw_totals(db, attempt_id)
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt.score = normalize_score(raw_earned, raw_possible)
    attempt.score_scale_version = 3
    db.flush()
    return attempt


@router.get("/results/exams")
def list_exam_results(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    exams = (
        db.query(Exam)
        .filter(Exam.manage_by == teacher.school_id, Exam.status == ExamStatus.published)
        .order_by(Exam.exam_id.desc())
        .all()
    )
    now = datetime.now()
    result = []
    for exam in exams:
        result.append({
            "id": str(exam.exam_id),
            "examId": exam.exam_id,
            "examName": exam.title,
            "subject": exam.subject.subject_name if exam.subject else "General",
            "date": exam.start_time.isoformat() if exam.start_time else None,
            "endDate": exam.end_time.isoformat() if exam.end_time else None,
            "duration": exam.duration_minutes,
            "status": _SCHEDULE_STATUS_MAP.get(get_exam_status(exam, now), "scheduled"),
            **_exam_stats(db, exam),
        })
    return result


@router.get("/results/exams/{exam_id}/overview")
def get_exam_results_overview(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    exam = _owned_exam(db, exam_id, teacher.school_id)
    return {
        "examId": exam.exam_id,
        "examName": exam.title,
        "subject": exam.subject.subject_name if exam.subject else "General",
        "startDate": exam.start_time.isoformat() if exam.start_time else None,
        "endDate": exam.end_time.isoformat() if exam.end_time else None,
        "status": _SCHEDULE_STATUS_MAP.get(get_exam_status(exam, datetime.now()), "scheduled"),
        **_exam_stats(db, exam),
    }


@router.put("/results/exams/{exam_id}/strategy")
def update_result_strategy(
    exam_id: int,
    payload: UpdateStrategyRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    exam = _owned_exam(db, exam_id, teacher.school_id)

    try:
        strategy = set_result_strategy(db, exam, payload.strategy)
        record_audit(db, actor_school_id=teacher.school_id, actor_role=teacher.role, action="RESULT_STRATEGY_UPDATED", entity_type="exam", entity_id=exam.exam_id, metadata={"result_strategy": strategy})
        db.commit()
        return {"resultStrategy": strategy}
    except Exception:
        db.rollback()
        raise


@router.get("/results/exams/{exam_id}/students")
def list_student_results(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    exam = _owned_exam(db, exam_id, teacher.school_id)
    return _build_student_rows(db, exam)


@router.get("/results/exams/{exam_id}/students/{attempt_id}")
def get_student_attempt_detail(
    exam_id: int,
    attempt_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    _owned_exam(db, exam_id, teacher.school_id)

    attempt = db.query(Attempt).filter(Attempt.attempt_id == attempt_id, Attempt.exam_id == exam_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    student = db.query(User).filter(User.school_id == attempt.student_id).first()

    links = (
        db.query(AttemptQuestion)
        .options(selectinload(AttemptQuestion.question).selectinload(Question.options))
        .filter(AttemptQuestion.attempt_id == attempt_id)
        .order_by(AttemptQuestion.display_order, AttemptQuestion.question_id)
        .all()
    )

    questions = []
    correct_count = 0
    for index, link in enumerate(links, start=1):
        question = link.question
        maximum = _max_score(link)
        max_points = float(maximum)
        question_type = _question_type_value(link)
        question_text = link.question_text_snapshot or question.question_text

        if question_type == QuestionType.essay.value:
            essay = (
                db.query(EssayAnswer)
                .filter(EssayAnswer.attempt_id == attempt_id, EssayAnswer.question_id == question.question_id)
                .first()
            )
            is_correct = essay.score is not None and essay.score > 0 if essay else None
            questions.append({
                "questionNumber": index,
                "question": question_text,
                "type": "essay",
                "correctAnswer": None,
                "studentAnswer": essay.answer_text if essay else None,
                "isCorrect": is_correct,
                "points": essay.score if essay and essay.score is not None else 0,
                "maxPoints": max_points,
            })
            continue

        mcq = (
            db.query(MCQAnswer)
            .options(selectinload(MCQAnswer.selected_option))
            .filter(MCQAnswer.attempt_id == attempt_id, MCQAnswer.question_id == question.question_id)
            .first()
        )
        selected_option = _snapshot_option(link, mcq.selected_option_id if mcq else None)
        options = link.options_snapshot if link.options_snapshot is not None else question.options
        correct_option = next((option for option in options if _option_is_correct(option)), None)
        is_correct = _option_is_correct(selected_option) if selected_option else None
        if is_correct:
            correct_count += 1

        def option_text(option):
            if option is None:
                return None
            return option.get("text") if isinstance(option, dict) else option.options_text

        questions.append({
            "questionNumber": index,
            "question": question_text,
            "type": "true-false" if question_type == QuestionType.true_false.value else "mcq",
            "correctAnswer": option_text(correct_option),
            "studentAnswer": option_text(selected_option),
            "isCorrect": is_correct,
            "points": max_points if is_correct else 0,
            "maxPoints": max_points,
        })

    raw_earned, raw_possible = _attempt_raw_totals(db, attempt_id)
    return {
        "attemptId": attempt.attempt_id,
        "studentId": student.school_id if student else None,
        "studentName": student.full_name if student else "Unknown",
        "score": _score_value(attempt.score),
        "rawEarnedScore": _score_value(raw_earned),
        "rawPossibleScore": _score_value(raw_possible),
        "gradingScale": float(GRADING_SCALE),
        "correctAnswers": correct_count,
        "totalQuestions": len(links),
        "timeSpent": _time_taken(attempt.start_time, attempt.end_time, attempt.submitted_at),
        "startTime": attempt.start_time.isoformat() if attempt.start_time else None,
        "submitTime": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        "questions": questions,
    }


@router.get("/results/exams/{exam_id}/statistics")
def get_question_statistics(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    exam = _owned_exam(db, exam_id, teacher.school_id)
    return _build_question_stats(db, exam)


@router.get("/results/exams/{exam_id}/essays")
def list_essay_answers(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    _owned_exam(db, exam_id, teacher.school_id)

    rows = (
        db.query(EssayAnswer, AttemptQuestion, Question, Attempt, User)
        .join(Attempt, Attempt.attempt_id == EssayAnswer.attempt_id)
        .join(
            AttemptQuestion,
            (AttemptQuestion.attempt_id == EssayAnswer.attempt_id)
            & (AttemptQuestion.question_id == EssayAnswer.question_id),
        )
        .join(Question, Question.question_id == EssayAnswer.question_id)
        .join(User, User.school_id == Attempt.student_id)
        .filter(Attempt.exam_id == exam_id, Attempt.submitted_at.isnot(None))
        .order_by(User.full_name)
        .all()
    )

    rows = [row for row in rows if row[0].answer_text and row[0].answer_text.strip()]

    return [
        {
            "essayAnswerId": essay.essay_answer_id,
            "attemptId": attempt.attempt_id,
            "attemptNumber": attempt.attempt_no,
            "studentId": user.school_id,
            "studentName": user.full_name,
            "questionId": question.question_id,
            "question": question.question_text,
            "answer": essay.answer_text,
            "maxPoints": float(
                attempt_question.question_point_snapshot
                if attempt_question.question_point_snapshot is not None
                else attempt_question.question_point or 0
            ),
            "currentScore": essay.score,
            "status": "graded" if essay.score is not None else "pending",
        }
        for essay, attempt_question, question, attempt, user in rows
    ]


@router.put("/results/exams/{exam_id}/essays/{essay_answer_id}")
def grade_essay_answer(
    exam_id: int,
    essay_answer_id: int,
    payload: GradeEssayRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    _owned_exam(db, exam_id, teacher.school_id)

    essay = (
        db.query(EssayAnswer)
        .join(Attempt, Attempt.attempt_id == EssayAnswer.attempt_id)
        .filter(EssayAnswer.essay_answer_id == essay_answer_id, Attempt.exam_id == exam_id)
        .with_for_update()
        .first()
    )
    if not essay:
        raise HTTPException(status_code=404, detail="Essay answer not found")
    if not essay.answer_text or not essay.answer_text.strip():
        raise HTTPException(status_code=400, detail="Blank essay answers are automatically graded as zero")

    attempt_question = (
        db.query(AttemptQuestion)
        .filter(AttemptQuestion.attempt_id == essay.attempt_id, AttemptQuestion.question_id == essay.question_id)
        .with_for_update()
        .first()
    )
    if attempt_question is None:
        raise HTTPException(status_code=409, detail="Attempt question snapshot not found")
    max_points = _max_score(attempt_question)
    try:
        awarded_score = validate_awarded_score(payload.score, max_points)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    try:
        essay.score = awarded_score
        attempt = _recompute_attempt_score(db, essay.attempt_id)
        exam = db.get(Exam, exam_id)
        final_score = sync_student_final_score(db, exam, attempt.student_id)
        record_audit(
            db,
            actor_school_id=teacher.school_id,
            actor_role=teacher.role,
            action="ESSAY_GRADED",
            entity_type="essay_answer",
            entity_id=essay.essay_answer_id,
            metadata={
                "exam_id": exam_id,
                "attempt_id": attempt.attempt_id,
                "result_finalized": final_score is not None,
                "invalidation": teacher_grading_finalized(exam_id).as_event_metadata(),
            },
        )
        if final_score is not None:
            record_audit(
                db,
                actor_school_id=teacher.school_id,
                actor_role=teacher.role,
                action="RESULT_FINALIZED",
                entity_type="student_exam",
                entity_id=f"{attempt.student_id}:{exam_id}",
                metadata={"exam_id": exam_id, "attempt_id": attempt.attempt_id},
            )
        enqueue_outbox_event(
            db,
            event_type="grading.essay_graded",
            aggregate_type="attempt",
            aggregate_id=attempt.attempt_id,
            metadata={"exam_id": exam_id, "essay_answer_id": essay.essay_answer_id, "result_finalized": final_score is not None},
        )
        db.commit()
        deliver_invalidation(teacher_grading_finalized(exam_id))
        return {
            "essayAnswerId": essay.essay_answer_id,
            "currentScore": essay.score,
            "status": "graded",
            "attemptScore": _score_value(attempt.score),
            "gradingScale": float(GRADING_SCALE),
            "finalScore": _score_value(final_score) if final_score is not None else None,
        }
    except Exception:
        db.rollback()
        raise


def _owned_report_job(db: Session, job_id: int, teacher_school_id: str):
    from src.a_db_config import BackgroundJob, BackgroundJobType

    job = db.get(BackgroundJob, job_id)
    if not job or job.job_type != BackgroundJobType.report_export:
        raise HTTPException(status_code=404, detail="Report job not found")
    metadata = job.result_metadata if isinstance(job.result_metadata, dict) else {}
    if metadata.get("report_type") != REPORT_TYPE_EXAM_RESULTS:
        raise HTTPException(status_code=404, detail="Report job not found")
    try:
        exam_id = int(metadata["exam_id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=409, detail="Report job metadata is invalid") from exc
    _owned_exam(db, exam_id, teacher_school_id)
    return job


@router.post("/results/exams/{exam_id}/report-jobs", status_code=202)
def create_exam_results_report_job(
    exam_id: int,
    payload: CreateReportJobRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    """Queue an idempotent XLSX export; RabbitMQ delivery occurs after commit."""
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    _owned_exam(db, exam_id, teacher.school_id)
    try:
        job, duplicate = request_exam_results_report(
            db,
            exam_id=exam_id,
            requested_by=teacher.school_id,
            request_id=payload.request_id,
        )
        db.commit()
        db.refresh(job)
        return {**report_job_summary(job), "duplicate": duplicate}
    except Exception:
        db.rollback()
        raise


@router.get("/results/report-jobs/{job_id}")
def get_exam_results_report_job(
    job_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    return report_job_summary(_owned_report_job(db, job_id, teacher.school_id))


@router.get("/results/report-jobs/{job_id}/download")
def download_exam_results_report_job(
    job_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    job = _owned_report_job(db, job_id, teacher.school_id)
    if job.status != BackgroundJobStatus.completed:
        raise HTTPException(status_code=409, detail="Report job is not complete")
    try:
        artifact = report_artifact_bytes(job)
    except FileNotFoundError:
        raise HTTPException(status_code=409, detail="Report artifact is not available")
    return Response(
        artifact,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="exam_results_{job.job_id}.xlsx"'},
    )


@router.get("/results/exams/{exam_id}/export.xlsx")
def export_exam_results_xlsx(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    exam = _owned_exam(db, exam_id, teacher.school_id)

    students = _build_student_rows(db, exam)
    stats = _build_question_stats(db, exam)

    workbook = Workbook()
    results_sheet = workbook.active
    results_sheet.title = "Student Results"
    results_sheet.append(
        ["Student ID", "Name", "Score (/100)", "Correct Answers", "Total Questions", "Time Spent", "Status", "Submitted At"]
    )
    for row in students:
        results_sheet.append([
            row["studentId"],
            row["name"],
            row["score"],
            row["correctAnswers"],
            row["totalQuestions"],
            row["timeSpent"],
            row["status"],
            row["submittedAt"] or "",
        ])

    stats_sheet = workbook.create_sheet("Question Statistics")
    stats_sheet.append(["Q#", "Type", "Difficulty", "Correct Rate (%)", "Total Attempts", "Answer Distribution"])
    for stat in stats:
        distribution = (
            "; ".join(f"{option['option']}: {option['percentage']}%" for option in stat["optionStats"])
            if stat.get("optionStats")
            else "Manual grading"
        )
        stats_sheet.append([
            stat["questionNumber"],
            stat["type"],
            stat["difficulty"],
            stat["correctRate"],
            stat["totalAttempts"],
            distribution,
        ])

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    safe_title = "".join(char for char in exam.title if char.isalnum() or char in (" ", "_", "-")).strip() or "exam"
    filename = f"{safe_title.replace(' ', '_')}_results.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
