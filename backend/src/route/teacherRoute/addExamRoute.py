from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
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
    MCQAnswer,
    StudentExam,
    Subject,
    User,
)
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token
from src.models.teacher.requestModel.TeacherExamRequest import TeacherExamRequest

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
    status_value = (
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
        "status": status_value,
    }


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
        start = datetime.now()
        exam = Exam(
            title=request.title.strip(),
            examcode=request.examcode.strip(),
            duration_minutes=request.duration_minutes,
            manage_by=teacher.school_id,
            max_attempt=request.max_attempt,
            description=request.description,
            start_time=start,
            end_time=start + timedelta(minutes=request.duration_minutes),
            result_visibility=request.result_visibility,
            subject_id=request.subject_id,
        )
        db.add(exam)
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
        # Preserve scheduling fields not represented by the current form, but keep an
        # existing derived end time aligned when duration changes.
        if exam.start_time and exam.end_time:
            exam.end_time = exam.start_time + timedelta(minutes=request.duration_minutes)
        db.commit()
        db.refresh(exam)
        return _serialize(exam)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Exam code is already in use") from exc


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
