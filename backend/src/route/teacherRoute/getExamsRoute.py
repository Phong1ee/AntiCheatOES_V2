from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from database import get_db
from src.a_db_config import Exam, ExamQuestion, Question, StudentExam, Subject, User
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token

router = APIRouter()


def get_exam_status(exam: Exam, now_time: datetime | None = None) -> str:
    current_time = now_time or datetime.now()
    if exam.start_time and current_time < exam.start_time:
        return "upcoming"
    if exam.start_time and exam.end_time and exam.start_time <= current_time <= exam.end_time:
        return "ongoing"
    if exam.end_time and current_time > exam.end_time:
        return "completed"
    return "ongoing"


def _teacher(db: Session, school_id: str) -> User:
    teacher = db.query(User).filter(User.school_id == school_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return teacher


def _owned_exam(db: Session, exam_id: int, school_id: str) -> Exam:
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.manage_by != school_id:
        raise HTTPException(status_code=403, detail="You do not manage this exam")
    return exam


def _serialize_exam(db: Session, exam: Exam, now_time: datetime) -> dict:
    return {
        "exam_id": exam.exam_id,
        "title": exam.title,
        "examcode": exam.examcode,
        "description": exam.description,
        "max_attempt": exam.max_attempt,
        "duration_minutes": exam.duration_minutes,
        "start_time": exam.start_time.isoformat() if exam.start_time else None,
        "end_time": exam.end_time.isoformat() if exam.end_time else None,
        "result_visibility": exam.result_visibility.value if exam.result_visibility else None,
        "subject_id": exam.subject_id,
        "totalStudents": db.query(StudentExam).filter_by(exam_id=exam.exam_id).count(),
        "manage_by": exam.manage_by,
        "status": get_exam_status(exam, now_time),
        "subject": exam.subject.subject_name if exam.subject else None,
    }


def _serialize_question(link: ExamQuestion) -> dict:
    question = link.question
    return {
        "question_id": question.question_id,
        "question_text": question.question_text,
        "question_difficulties": question.question_difficulties.value,
        "question_type": question.question_type.value,
        "subject_id": question.subject_id,
        "chapter_ids": [item.chapter_id for item in question.chapter_questions],
        "lo_ids": [item.lo_id for item in question.lo_questions],
        "created_by": question.created_by,
        "question_status": question.question_status.value if question.question_status else None,
        "question_point": link.question_point,
        "options": [
            {"options_id": option.options_id, "options_text": option.options_text, "is_correct": option.is_correct}
            for option in sorted(question.options, key=lambda item: item.options_id)
        ],
    }


@router.get("/exams")
def get_teacher_exams(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    exams = (
        db.query(Exam)
        .options(selectinload(Exam.subject))
        .filter(Exam.manage_by == teacher.school_id)
        .order_by(Exam.exam_id.desc())
        .all()
    )
    now = datetime.now()
    return [_serialize_exam(db, exam, now) for exam in exams]


@router.get("/get_exams")
def get_exams(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    return get_teacher_exams(current_user, role_check, db)


@router.get("/get_exam/{exam_id}")
def get_exam(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    exam = _owned_exam(db, exam_id, current_user["school_id"])
    return _serialize_exam(db, exam, datetime.now())


@router.get("/{exam_id}/get_exam_questions/")
def get_exam_questions(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _owned_exam(db, exam_id, current_user["school_id"])
    links = (
        db.query(ExamQuestion)
        .options(
            selectinload(ExamQuestion.question).selectinload(Question.options),
            selectinload(ExamQuestion.question).selectinload(Question.chapter_questions),
            selectinload(ExamQuestion.question).selectinload(Question.lo_questions),
        )
        .filter(ExamQuestion.exam_id == exam_id)
        .order_by(ExamQuestion.question_id)
        .all()
    )
    return [_serialize_question(link) for link in links]


@router.get("/{exam_id}/get_exam_question/{question_id}")
def get_exam_question(
    exam_id: int,
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _owned_exam(db, exam_id, current_user["school_id"])
    link = (
        db.query(ExamQuestion)
        .options(
            selectinload(ExamQuestion.question).selectinload(Question.options),
            selectinload(ExamQuestion.question).selectinload(Question.chapter_questions),
            selectinload(ExamQuestion.question).selectinload(Question.lo_questions),
        )
        .filter_by(exam_id=exam_id, question_id=question_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Question not found in this exam")
    return _serialize_question(link)


@router.get("/get_exam_overview/")
def get_exam_overview(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    now = datetime.now()
    active = db.query(Exam).filter(Exam.manage_by == teacher.school_id, Exam.start_time <= now, Exam.end_time >= now).first()
    upcoming = db.query(Exam).filter(Exam.manage_by == teacher.school_id, Exam.start_time > now).order_by(Exam.start_time).limit(4).all()
    total_students = (
        db.query(func.count(func.distinct(StudentExam.student_id)))
        .join(Exam, StudentExam.exam_id == Exam.exam_id)
        .filter(Exam.manage_by == teacher.school_id)
        .scalar() or 0
    )
    subjects = (
        db.query(
            Subject.subject_id,
            Subject.subject_name,
            Subject.subject_description,
            func.count(Question.question_id).label("question_count"),
        )
        .outerjoin(Question, Subject.subject_id == Question.subject_id)
        .group_by(Subject.subject_id, Subject.subject_name, Subject.subject_description)
        .order_by(Subject.subject_name)
        .limit(50)
        .all()
    )
    return {
        "active_exam": _serialize_exam(db, active, now) if active else None,
        "upcoming_exams": [_serialize_exam(db, exam, now) for exam in upcoming],
        "total_students": total_students,
        "subjects": [
            {
                "subject_id": item.subject_id,
                "subject_name": item.subject_name,
                "subject_description": item.subject_description,
                "question_count": item.question_count,
            }
            for item in subjects
        ],
    }
