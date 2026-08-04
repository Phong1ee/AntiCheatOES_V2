from datetime import datetime
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from src.a_db_config import (
    Attempt,
    AttemptQuestion,
    EssayAnswer,
    Exam,
    ExamEvent,
    ExamQuestion,
    ExamPoolConfig,
    ExamPoolQuestion,
    ExamPoolRule,
    ExamSetting,
    MCQAnswer,
    StudentExam,
    Subject,
    User,
)
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token
from src.models.teacher.requestModel.TeacherExamRequest import (
    TeacherExamRequest,
    TeacherResultVisibilityRequest,
    TeacherExamStatusRequest,
)

router = APIRouter()


def _teacher(db: Session, school_id: str) -> User:
    teacher = db.query(User).filter(User.school_id == school_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return teacher


def _exam_for_mutation(db: Session, exam_id: int, school_id: str) -> Exam:
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.manage_by != school_id:
        raise HTTPException(status_code=403, detail="You do not manage this exam")
    return exam


def _validate_subject(db: Session, subject_id: str) -> None:
    if not db.query(Subject).filter(Subject.subject_id == subject_id).first():
        raise HTTPException(status_code=404, detail="Subject not found")


def _serialize(exam: Exam) -> dict:
    now = datetime.now()
    schedule_status = (
        "upcoming" if exam.start_time and now < exam.start_time
        else "completed" if exam.end_time and now > exam.end_time
        else "ongoing"
    )
    return {
        "exam_id": exam.exam_id,
        "title": exam.title,
        "examcode": exam.examcode,
        "max_attempt": exam.max_attempt,
        "description": exam.description,
        "duration_minutes": exam.duration_minutes,
        "start_time": exam.start_time.isoformat() if exam.start_time else None,
        "end_time": exam.end_time.isoformat() if exam.end_time else None,
        "result_visibility": exam.result_visibility.value if exam.result_visibility else None,
        "subject_id": exam.subject_id,
        "manage_by": exam.manage_by,
        "subject": exam.subject.subject_name if exam.subject else None,
        "totalStudents": len(exam.student_exams),
        "status": exam.status.value if hasattr(exam.status, "value") else exam.status,
        "schedule_status": schedule_status,
        "total_points": exam.total_points if exam.total_points is not None else 100,
        "passing_score": exam.passing_score if exam.passing_score is not None else 50,
        "question_selection_mode": (
            exam.question_selection_mode.value
            if hasattr(exam.question_selection_mode, "value")
            else exam.question_selection_mode
        ),
    }


def _validate_publishable(db: Session, exam: Exam, total_points: int) -> None:
    mode = (
        exam.question_selection_mode.value
        if hasattr(exam.question_selection_mode, "value")
        else exam.question_selection_mode
    )
    if mode == "pool":
        config = db.query(ExamPoolConfig).filter_by(exam_id=exam.exam_id).first()
        rule_count = (
            db.query(func.count(ExamPoolRule.rule_id))
            .filter(ExamPoolRule.pool_config_id == config.pool_config_id)
            .scalar()
            if config
            else 0
        )
        if not config or not rule_count:
            raise HTTPException(status_code=422, detail="A published pool exam requires a saved pool configuration")
        return
    links = db.query(ExamQuestion).filter(ExamQuestion.exam_id == exam.exam_id).all()
    if not links:
        raise HTTPException(status_code=422, detail="A published exam requires at least one question")
    assigned = sum((Decimal(str(link.question_point)) for link in links), Decimal("0.00"))
    if assigned != Decimal(str(total_points)).quantize(Decimal("0.01")):
        raise HTTPException(
            status_code=422,
            detail=f"Assigned question points ({assigned}) must equal exam total points ({total_points})",
        )


def _new_exam_code(db: Session) -> str:
    """Generate a code that fits exam.examcode (VARCHAR(20)) and avoids known collisions."""
    for _ in range(20):
        candidate = secrets.token_hex(10).upper()
        if not db.query(Exam.exam_id).filter(Exam.examcode == candidate).first():
            return candidate
    raise HTTPException(status_code=409, detail="Unable to generate a unique exam code")


def _copy_exam_settings(db: Session, source_exam_id: int, target_exam_id: int) -> None:
    source = db.get(ExamSetting, source_exam_id)
    if not source:
        return
    db.add(
        ExamSetting(
            exam_id=target_exam_id,
            shuffle_question=source.shuffle_question,
            shuffle_answer_options=source.shuffle_answer_options,
            sequential_navigation=source.sequential_navigation,
            auto_submit_on_expire=source.auto_submit_on_expire,
            grace_period=source.grace_period,
            force_fullscreen_thresh=source.force_fullscreen_thresh,
            tab_switch_thresh=source.tab_switch_thresh,
            copy_paste_thresh=source.copy_paste_thresh,
            auto_grade=source.auto_grade,
            result_strategy=source.result_strategy,
        )
    )


def _copy_pool_configuration(db: Session, source_exam_id: int, target_exam_id: int) -> None:
    source_config = db.query(ExamPoolConfig).filter_by(exam_id=source_exam_id).first()
    if not source_config:
        return
    target_config = ExamPoolConfig(
        exam_id=target_exam_id,
        subject_id=source_config.subject_id,
        fixed_randomization=source_config.fixed_randomization,
        version=source_config.version,
    )
    db.add(target_config)
    db.flush()
    source_rules = (
        db.query(ExamPoolRule)
        .filter(ExamPoolRule.pool_config_id == source_config.pool_config_id)
        .order_by(ExamPoolRule.rule_id)
        .all()
    )
    for source_rule in source_rules:
        target_rule = ExamPoolRule(
            pool_config_id=target_config.pool_config_id,
            chapter_id=source_rule.chapter_id,
            lo_id=source_rule.lo_id,
            difficulty=source_rule.difficulty,
            draw_count=source_rule.draw_count,
        )
        db.add(target_rule)
        db.flush()
        candidate_ids = (
            db.query(ExamPoolQuestion.question_id)
            .filter(ExamPoolQuestion.rule_id == source_rule.rule_id)
            .all()
        )
        db.add_all(
            ExamPoolQuestion(rule_id=target_rule.rule_id, question_id=question_id)
            for (question_id,) in candidate_ids
        )


@router.post("/add_exam", status_code=status.HTTP_201_CREATED)
def add_exam_to_database(
    request: TeacherExamRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        teacher = _teacher(db, current_user["school_id"])
        _validate_subject(db, request.subject_id)
        exam = Exam(
            title=request.title.strip(),
            examcode=request.examcode.strip(),
            duration_minutes=request.duration_minutes,
            manage_by=teacher.school_id,
            max_attempt=request.max_attempt,
            description=request.description,
            start_time=request.start_time,
            end_time=request.end_time,
            status=request.status,
            result_visibility=request.result_visibility,
            subject_id=request.subject_id,
            total_points=request.total_points,
            passing_score=request.passing_score,
        )
        db.add(exam)
        db.flush()
        if request.status == "published":
            _validate_publishable(db, exam, request.total_points)
        db.commit()
        db.refresh(exam)
        return _serialize(exam)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Exam code is already in use") from exc


@router.put("/update_exam/{exam_id}")
def update_exam_in_database(
    exam_id: int,
    request: TeacherExamRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        exam = _exam_for_mutation(db, exam_id, current_user["school_id"])
        _validate_subject(db, request.subject_id)
        exam.title = request.title.strip()
        exam.examcode = request.examcode.strip()
        exam.duration_minutes = request.duration_minutes
        exam.max_attempt = request.max_attempt
        exam.description = request.description
        exam.result_visibility = request.result_visibility
        exam.subject_id = request.subject_id
        exam.start_time = request.start_time
        exam.end_time = request.end_time
        if request.status == "published":
            _validate_publishable(db, exam, request.total_points)
        exam.status = request.status
        exam.total_points = request.total_points
        exam.passing_score = request.passing_score
        db.commit()
        db.refresh(exam)
        return _serialize(exam)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Exam code is already in use") from exc


@router.post("/exams/{exam_id}/duplicate", status_code=status.HTTP_201_CREATED)
def duplicate_exam(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        source = _exam_for_mutation(db, exam_id, current_user["school_id"])
        duplicate = Exam(
            manage_by=current_user["school_id"],
            title=f"Copy of {source.title}"[:255],
            examcode=_new_exam_code(db),
            max_attempt=source.max_attempt,
            description=source.description,
            duration_minutes=source.duration_minutes,
            start_time=source.start_time,
            end_time=source.end_time,
            status="draft",
            result_visibility=source.result_visibility,
            subject_id=source.subject_id,
            total_points=source.total_points,
            passing_score=source.passing_score,
            question_selection_mode=source.question_selection_mode,
        )
        db.add(duplicate)
        db.flush()

        source_questions = db.query(ExamQuestion).filter_by(exam_id=source.exam_id).all()
        db.add_all(
            ExamQuestion(
                exam_id=duplicate.exam_id,
                question_id=link.question_id,
                question_point=link.question_point,
            )
            for link in source_questions
        )
        _copy_exam_settings(db, source.exam_id, duplicate.exam_id)
        _copy_pool_configuration(db, source.exam_id, duplicate.exam_id)

        db.commit()
        db.refresh(duplicate)
        return _serialize(duplicate)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Exam could not be duplicated") from exc
    except Exception:
        db.rollback()
        raise


@router.patch("/exams/{exam_id}/status")
def update_exam_status(
    exam_id: int,
    request: TeacherExamStatusRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        exam = _exam_for_mutation(db, exam_id, current_user["school_id"])
        if request.status == "published":
            _validate_publishable(
                db,
                exam,
                exam.total_points if exam.total_points is not None else 100,
            )
        exam.status = request.status
        db.commit()
        db.refresh(exam)
        return _serialize(exam)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.patch("/exams/{exam_id}/result-visibility")
def update_result_visibility(
    exam_id: int,
    request: TeacherResultVisibilityRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        exam = _exam_for_mutation(db, exam_id, current_user["school_id"])
        exam.result_visibility = request.result_visibility
        db.commit()
        db.refresh(exam)
        return {
            "exam_id": exam.exam_id,
            "result_visibility": exam.result_visibility.value,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.delete("/delete_exam/{exam_id}")
def delete_exam_from_database(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    """Delete an owned exam and attempt data while retaining reusable questions/options."""
    del role_check
    try:
        exam = _exam_for_mutation(db, exam_id, current_user["school_id"])
        attempt_ids = [row[0] for row in db.query(Attempt.attempt_id).filter(Attempt.exam_id == exam_id).all()]
        if attempt_ids:
            db.query(MCQAnswer).filter(MCQAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(EssayAnswer).filter(EssayAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(ExamEvent).filter(ExamEvent.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(AttemptQuestion).filter(AttemptQuestion.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(Attempt).filter(Attempt.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(StudentExam).filter(StudentExam.exam_id == exam_id).delete(synchronize_session=False)
        db.query(ExamQuestion).filter(ExamQuestion.exam_id == exam_id).delete(synchronize_session=False)
        db.delete(exam)
        db.commit()
        return {"success": True, "message": "Exam deleted"}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Exam could not be deleted because dependent data remains") from exc
