import io
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from database import get_db
from src.a_db_config import (
    Attempt,
    AttemptQuestion,
    Exam,
    ExamQuestion,
    EssayAnswer,
    MCQAnswer,
    Option,
    Question,
    QuestionType,
    StudentExam,
    User,
)
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token
from src.route.teacherRoute.getExamsRoute import _owned_exam, _teacher, get_exam_status

router = APIRouter()

_SCHEDULE_STATUS_MAP = {"upcoming": "scheduled", "ongoing": "in-progress", "completed": "completed"}


class GradeEssayRequest(BaseModel):
    score: float


def _score_value(value):
    if value is None:
        return 0
    return round(float(value), 2)


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


def _submitted_attempts_by_student(db: Session, exam_id: int) -> dict:
    """Map student_id (user.id) -> all of their submitted attempts for this exam, ordered by attempt_no."""
    attempts = (
        db.query(Attempt)
        .filter(Attempt.exam_id == exam_id, Attempt.submitted_at.isnot(None))
        .order_by(Attempt.attempt_no)
        .all()
    )
    by_student: dict = {}
    for attempt in attempts:
        by_student.setdefault(attempt.student_id, []).append(attempt)
    return by_student


def _best_attempt(attempts: list):
    """Pick the highest-scoring attempt from a student's submitted attempts (tie-break: latest attempt_no)."""
    if not attempts:
        return None
    return max(attempts, key=lambda a: (float(a.score) if a.score is not None else -1, a.attempt_no or 0))


def _attempt_breakdown(db: Session, attempt_id: int):
    total_questions = (
        db.query(func.count(AttemptQuestion.question_id))
        .filter(AttemptQuestion.attempt_id == attempt_id)
        .scalar()
        or 0
    )
    correct = (
        db.query(func.count(MCQAnswer.mcq_answer_id))
        .join(Option, Option.options_id == MCQAnswer.selected_option_id)
        .filter(MCQAnswer.attempt_id == attempt_id, Option.is_correct == True)  # noqa: E712
        .scalar()
        or 0
    )
    return correct, total_questions


def _attempt_status(attempt, exam: Exam) -> str:
    if exam.end_time and attempt.submitted_at and attempt.submitted_at > exam.end_time:
        return "late"
    return "submitted"


def _essay_counts(db: Session, attempt_ids: list):
    if not attempt_ids:
        return 0, 0
    rows = db.query(EssayAnswer.score).filter(EssayAnswer.attempt_id.in_(attempt_ids)).all()
    total = len(rows)
    pending = sum(1 for (score,) in rows if score is None)
    return total, pending


def _has_essay_questions(db: Session, exam_id: int) -> bool:
    return (
        db.query(ExamQuestion)
        .join(Question, Question.question_id == ExamQuestion.question_id)
        .filter(ExamQuestion.exam_id == exam_id, Question.question_type == QuestionType.essay)
        .first()
        is not None
    )


def _exam_stats(db: Session, exam: Exam) -> dict:
    roster = (
        db.query(StudentExam, User)
        .join(User, User.school_id == StudentExam.student_id)
        .filter(StudentExam.exam_id == exam.exam_id)
        .all()
    )
    submitted_by_student = _submitted_attempts_by_student(db, exam.exam_id)
    scores = []
    submitted_count = 0
    for _student_exam, user in roster:
        best = _best_attempt(submitted_by_student.get(user.id, []))
        if best:
            submitted_count += 1
            if best.score is not None:
                scores.append(float(best.score))

    total_questions = (
        db.query(func.count(ExamQuestion.question_id)).filter(ExamQuestion.exam_id == exam.exam_id).scalar() or 0
    )
    # Essay counts span every submitted attempt (not just each student's best) so a teacher can
    # grade essays from any attempt, since grading can itself change which attempt ends up "best".
    all_submitted_ids = [attempt.attempt_id for attempts in submitted_by_student.values() for attempt in attempts]
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
    }


def _build_student_rows(db: Session, exam: Exam) -> list:
    roster = (
        db.query(StudentExam, User)
        .join(User, User.school_id == StudentExam.student_id)
        .filter(StudentExam.exam_id == exam.exam_id)
        .order_by(User.full_name)
        .all()
    )
    submitted_by_student = _submitted_attempts_by_student(db, exam.exam_id)
    rows = []
    for _student_exam, user in roster:
        attempts_list = submitted_by_student.get(user.id, [])

        attempt_summaries = []
        for attempt in attempts_list:
            correct, total_questions = _attempt_breakdown(db, attempt.attempt_id)
            attempt_summaries.append({
                "attemptId": attempt.attempt_id,
                "attemptNumber": attempt.attempt_no,
                "score": _score_value(attempt.score),
                "correctAnswers": correct,
                "totalQuestions": total_questions,
                "timeSpent": _time_taken(attempt.start_time, attempt.end_time, attempt.submitted_at),
                "status": _attempt_status(attempt, exam),
                "submittedAt": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            })

        best = _best_attempt(attempts_list)
        best_summary = (
            next(s for s in attempt_summaries if s["attemptId"] == best.attempt_id) if best else None
        )

        rows.append({
            "id": str(best.attempt_id) if best else user.school_id,
            "attemptId": best.attempt_id if best else None,
            "studentId": user.school_id,
            "name": user.full_name,
            "score": best_summary["score"] if best_summary else 0,
            "correctAnswers": best_summary["correctAnswers"] if best_summary else 0,
            "totalQuestions": best_summary["totalQuestions"] if best_summary else 0,
            "timeSpent": best_summary["timeSpent"] if best_summary else "-",
            "status": best_summary["status"] if best_summary else "not-submitted",
            "submittedAt": best_summary["submittedAt"] if best_summary else None,
            "attempts": attempt_summaries,
        })
    return rows


def _build_question_stats(db: Session, exam: Exam) -> list:
    # One data point per student (their best attempt), so a student who retried isn't counted 3x.
    submitted_by_student = _submitted_attempts_by_student(db, exam.exam_id)
    submitted_attempt_ids = []
    for attempts in submitted_by_student.values():
        best = _best_attempt(attempts)
        if best:
            submitted_attempt_ids.append(best.attempt_id)
    links = (
        db.query(ExamQuestion)
        .options(selectinload(ExamQuestion.question).selectinload(Question.options))
        .filter(ExamQuestion.exam_id == exam.exam_id)
        .order_by(ExamQuestion.question_id)
        .all()
    )

    stats = []
    for index, link in enumerate(links, start=1):
        question = link.question
        max_points = float(link.question_point) if link.question_point else 0

        if question.question_type == QuestionType.essay:
            essays = (
                db.query(EssayAnswer)
                .filter(
                    EssayAnswer.question_id == question.question_id,
                    EssayAnswer.attempt_id.in_(submitted_attempt_ids or [-1]),
                )
                .all()
            )
            graded = [essay.score for essay in essays if essay.score is not None]
            correct_rate = round((sum(graded) / len(graded)) / max_points * 100, 1) if graded and max_points else 0
            stats.append({
                "questionNumber": index,
                "type": "essay",
                "difficulty": question.question_difficulties.value if question.question_difficulties else "medium",
                "correctRate": correct_rate,
                "totalAttempts": len(essays),
                "optionStats": None,
            })
            continue

        mcqs = (
            db.query(MCQAnswer)
            .options(selectinload(MCQAnswer.selected_option))
            .filter(
                MCQAnswer.question_id == question.question_id,
                MCQAnswer.attempt_id.in_(submitted_attempt_ids or [-1]),
            )
            .all()
        )
        total_attempts = len(mcqs)
        correct_count = sum(1 for mcq in mcqs if mcq.selected_option and mcq.selected_option.is_correct)
        option_counts = {
            option.options_id: {"option": option.options_text, "count": 0}
            for option in sorted(question.options, key=lambda item: item.options_id)
        }
        for mcq in mcqs:
            if mcq.selected_option_id in option_counts:
                option_counts[mcq.selected_option_id]["count"] += 1
        option_stats = [
            {
                "option": info["option"],
                "percentage": round(info["count"] / total_attempts * 100, 1) if total_attempts else 0,
            }
            for info in option_counts.values()
        ]
        stats.append({
            "questionNumber": index,
            "type": "true-false" if question.question_type == QuestionType.true_false else "mcq",
            "difficulty": question.question_difficulties.value if question.question_difficulties else "medium",
            "correctRate": round(correct_count / total_attempts * 100, 1) if total_attempts else 0,
            "totalAttempts": total_attempts,
            "optionStats": option_stats,
        })
    return stats


def _recompute_attempt_score(db: Session, attempt_id: int) -> None:
    mcq_rows = (
        db.query(AttemptQuestion.question_point, Option.is_correct)
        .join(
            MCQAnswer,
            (MCQAnswer.attempt_id == AttemptQuestion.attempt_id) & (MCQAnswer.question_id == AttemptQuestion.question_id),
        )
        .join(Option, Option.options_id == MCQAnswer.selected_option_id)
        .filter(AttemptQuestion.attempt_id == attempt_id)
        .all()
    )
    mcq_total = sum((points for points, is_correct in mcq_rows if is_correct), Decimal("0"))
    essay_total = (
        db.query(func.coalesce(func.sum(EssayAnswer.score), 0)).filter(EssayAnswer.attempt_id == attempt_id).scalar()
    )
    attempt = db.get(Attempt, attempt_id)
    attempt.score = mcq_total + Decimal(str(essay_total or 0))
    db.commit()


@router.get("/results/exams")
def list_exam_results(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    exams = db.query(Exam).filter(Exam.manage_by == teacher.school_id).order_by(Exam.exam_id.desc()).all()
    now = datetime.now()
    result = []
    for exam in exams:
        result.append({
            "id": str(exam.exam_id),
            "examId": exam.exam_id,
            "examName": exam.title,
            "subject": exam.subject.subject_name if exam.subject else "General",
            "date": exam.start_time.isoformat() if exam.start_time else None,
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
    student = db.query(User).filter(User.id == attempt.student_id).first()

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
        max_points = float(link.question_point) if link.question_point else 0

        if question.question_type == QuestionType.essay:
            essay = (
                db.query(EssayAnswer)
                .filter(EssayAnswer.attempt_id == attempt_id, EssayAnswer.question_id == question.question_id)
                .first()
            )
            is_correct = essay.score is not None and essay.score > 0 if essay else None
            questions.append({
                "questionNumber": index,
                "question": question.question_text,
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
        selected_option = mcq.selected_option if mcq else None
        correct_option = next((option for option in question.options if option.is_correct), None)
        is_correct = bool(selected_option.is_correct) if selected_option else None
        if is_correct:
            correct_count += 1

        questions.append({
            "questionNumber": index,
            "question": question.question_text,
            "type": "true-false" if question.question_type == QuestionType.true_false else "mcq",
            "correctAnswer": correct_option.options_text if correct_option else None,
            "studentAnswer": selected_option.options_text if selected_option else None,
            "isCorrect": is_correct,
            "points": max_points if is_correct else 0,
            "maxPoints": max_points,
        })

    return {
        "attemptId": attempt.attempt_id,
        "studentId": student.school_id if student else None,
        "studentName": student.full_name if student else "Unknown",
        "score": _score_value(attempt.score),
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
        .join(User, User.id == Attempt.student_id)
        .filter(Attempt.exam_id == exam_id)
        .order_by(User.full_name)
        .all()
    )

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
            "maxPoints": float(attempt_question.question_point) if attempt_question.question_point else 0,
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
        .first()
    )
    if not essay:
        raise HTTPException(status_code=404, detail="Essay answer not found")

    attempt_question = (
        db.query(AttemptQuestion)
        .filter(AttemptQuestion.attempt_id == essay.attempt_id, AttemptQuestion.question_id == essay.question_id)
        .first()
    )
    max_points = float(attempt_question.question_point) if attempt_question and attempt_question.question_point else 0
    if payload.score < 0 or payload.score > max_points:
        raise HTTPException(status_code=400, detail=f"Score must be between 0 and {max_points}")

    essay.score = int(round(payload.score))
    db.commit()
    _recompute_attempt_score(db, essay.attempt_id)

    attempt = db.get(Attempt, essay.attempt_id)
    return {
        "essayAnswerId": essay.essay_answer_id,
        "currentScore": essay.score,
        "status": "graded",
        "attemptScore": _score_value(attempt.score),
    }


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
        ["Student ID", "Name", "Score", "Correct Answers", "Total Questions", "Time Spent", "Status", "Submitted At"]
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
