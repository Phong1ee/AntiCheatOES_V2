from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from database import get_db
from src.a_db_config import (
    Attempt,
    ChapterQuestion,
    CourseClass,
    Exam,
    ExamQuestion,
    ExamStatus,
    Question,
    LOQuestion,
    StudentClass,
    StudentExam,
    Subject,
    User,
    UserRole,
)
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token
from src.service.teacher_subject_service import active_subject_ids

router = APIRouter()


class AssignmentSyncRequest(BaseModel):
    class_ids: list[int] = Field(default_factory=list)
    student_ids: list[str] = Field(default_factory=list)
    excluded_student_ids: list[str] = Field(default_factory=list)

    @field_validator("class_ids", "student_ids", "excluded_student_ids")
    @classmethod
    def unique_values(cls, value: list):
        if len(value) != len(set(value)):
            raise ValueError("Assignment identifiers must not contain duplicates")
        return value


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


def _assignment_options(db: Session, exam_id: int, teacher_school_id: str) -> dict:
    _owned_exam(db, exam_id, teacher_school_id)
    classes = (
        db.query(CourseClass)
        .options(
            selectinload(CourseClass.subject),
            selectinload(CourseClass.student_classes).selectinload(StudentClass.student),
        )
        .filter(CourseClass.teacher_id == teacher_school_id)
        .order_by(CourseClass.class_name, CourseClass.class_id)
        .all()
    )
    assigned_ids = {
        row[0]
        for row in db.query(StudentExam.student_id)
        .filter(StudentExam.exam_id == exam_id)
        .all()
    }
    student_map: dict[str, dict] = {}
    for course_class in classes:
        for membership in course_class.student_classes:
            student = membership.student
            if not student or student.role != UserRole.student:
                continue
            item = student_map.setdefault(
                student.school_id,
                {
                    "school_id": student.school_id,
                    "full_name": student.full_name,
                    "email": student.email,
                    "class_ids": [],
                    "class_names": [],
                    "assigned": student.school_id in assigned_ids,
                },
            )
            item["class_ids"].append(course_class.class_id)
            item["class_names"].append(course_class.class_name)
    return {
        "classes": [
            {
                "class_id": course_class.class_id,
                "class_name": course_class.class_name,
                "subject_id": course_class.subject_id,
                "student_count": len(
                    {
                        membership.student_id
                        for membership in course_class.student_classes
                        if membership.student and membership.student.role == UserRole.student
                    }
                ),
            }
            for course_class in classes
        ],
        "students": list(student_map.values()),
        "assigned_count": len(assigned_ids),
    }


def _serialize_exam(db: Session, exam: Exam, now_time: datetime) -> dict:
    return {
        "exam_id": exam.exam_id,
        "title": exam.title,
        "examcode": exam.examcode,
        "requires_exam_code": bool(exam.examcode and exam.examcode.strip()),
        "description": exam.description,
        "max_attempt": exam.max_attempt,
        "duration_minutes": exam.duration_minutes,
        "start_time": exam.start_time.isoformat() if exam.start_time else None,
        "end_time": exam.end_time.isoformat() if exam.end_time else None,
        "result_visibility": exam.result_visibility.value if exam.result_visibility else None,
        "subject_id": exam.subject_id,
        "totalStudents": db.query(StudentExam).filter_by(exam_id=exam.exam_id).count(),
        "manage_by": exam.manage_by,
        "status": exam.status.value if hasattr(exam.status, "value") else exam.status,
        "schedule_status": get_exam_status(exam, now_time),
        "subject": exam.subject.subject_name if exam.subject else None,
        "total_points": 100,
        "grading_scale": 100,
        "passing_score": exam.passing_score if exam.passing_score is not None else 50,
        "question_selection_mode": (
            exam.question_selection_mode.value
            if hasattr(exam.question_selection_mode, "value")
            else exam.question_selection_mode
        ),
    }


def _serialize_question(
    link: ExamQuestion,
    assigned_subject_ids: set[str],
) -> dict:
    question = link.question
    question_status = (
        question.question_status.value
        if hasattr(question.question_status, "value")
        else question.question_status
    )
    question_difficulty = (
        question.question_difficulties.value
        if hasattr(question.question_difficulties, "value")
        else question.question_difficulties
    )
    question_type = (
        question.question_type.value
        if hasattr(question.question_type, "value")
        else question.question_type
    )
    return {
        "question_id": question.question_id,
        "question_text": question.question_text,
        "question_difficulties": question_difficulty,
        "question_type": question_type,
        "subject_id": question.subject_id,
        "chapter_ids": [item.chapter_id for item in question.chapter_questions],
        "lo_ids": [item.lo_id for item in question.lo_questions],
        "created_by": question.created_by,
        "question_status": question_status,
        "question_point": link.question_point,
        "max_score": link.question_point,
        "can_edit_content": question.subject_id in assigned_subject_ids,
        "can_edit_points": True,
        "source_question_id": question.source_question_id,
        "question_bank_target_id": question.question_id,
        "question_bank_target_tab": "bank" if question_status == "approved" else "mine",
        "chapters": [
            {
                "chapter_id": item.chapter.chapter_id,
                "chapter_name": item.chapter.chapter_name,
            }
            for item in question.chapter_questions
            if item.chapter
        ],
        "learning_objectives": [
            {"lo_id": item.lo.lo_id, "lo_name": item.lo.lo_name}
            for item in question.lo_questions
            if item.lo
        ],
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


@router.get("/exams/{exam_id}/assignment-options")
def get_assignment_options(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    return _assignment_options(db, exam_id, current_user["school_id"])


@router.get("/exams/{exam_id}/assignments")
def get_assignments(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    options = _assignment_options(db, exam_id, current_user["school_id"])
    assigned = [student["school_id"] for student in options["students"] if student["assigned"]]
    return {"exam_id": exam_id, "student_ids": assigned, "assigned_count": len(assigned)}


@router.put("/exams/{exam_id}/assignments")
def sync_assignments(
    exam_id: int,
    request: AssignmentSyncRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher_school_id = current_user["school_id"]
    try:
        _owned_exam(db, exam_id, teacher_school_id)
        owned_classes = (
            db.query(CourseClass)
            .filter(
                CourseClass.teacher_id == teacher_school_id,
                CourseClass.class_id.in_(request.class_ids or [-1]),
            )
            .all()
        )
        if len(owned_classes) != len(request.class_ids):
            raise HTTPException(status_code=403, detail="One or more classes are not taught by this teacher")

        roster_ids = {
            row[0]
            for row in db.query(StudentClass.student_id)
            .join(CourseClass, CourseClass.class_id == StudentClass.class_id)
            .join(User, User.school_id == StudentClass.student_id)
            .filter(
                CourseClass.teacher_id == teacher_school_id,
                User.role == UserRole.student,
            )
            .distinct()
            .all()
        }
        submitted_ids = set(request.student_ids) | set(request.excluded_student_ids)
        invalid_ids = sorted(submitted_ids - roster_ids)
        if invalid_ids:
            raise HTTPException(
                status_code=422,
                detail={"message": "Students must belong to a class taught by this teacher", "student_ids": invalid_ids},
            )
        class_student_ids = {
            row[0]
            for row in db.query(StudentClass.student_id)
            .filter(StudentClass.class_id.in_(request.class_ids or [-1]))
            .distinct()
            .all()
        }
        desired_ids = (class_student_ids | set(request.student_ids)) - set(request.excluded_student_ids)
        existing_ids = {
            row[0]
            for row in db.query(StudentExam.student_id)
            .filter(StudentExam.exam_id == exam_id)
            .all()
        }
        added_ids = desired_ids - existing_ids
        removed_ids = existing_ids - desired_ids
        blocked_ids = {
            row[0]
            for row in db.query(Attempt.student_id)
            .filter(Attempt.exam_id == exam_id, Attempt.student_id.in_(removed_ids or [""]))
            .distinct()
            .all()
        }
        if blocked_ids:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Assignments with existing attempts cannot be removed",
                    "student_ids": sorted(blocked_ids),
                },
            )
        if removed_ids:
            db.query(StudentExam).filter(
                StudentExam.exam_id == exam_id,
                StudentExam.student_id.in_(removed_ids),
            ).delete(synchronize_session=False)
        db.add_all(
            StudentExam(exam_id=exam_id, student_id=student_id)
            for student_id in sorted(added_ids)
        )
        db.commit()
        return {
            "added_count": len(added_ids),
            "removed_count": len(removed_ids),
            "unchanged_count": len(existing_ids & desired_ids),
            "final_count": len(desired_ids),
            "student_ids": sorted(desired_ids),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


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
    assigned_subjects = active_subject_ids(db, current_user["school_id"])
    links = (
        db.query(ExamQuestion)
        .options(
            selectinload(ExamQuestion.question).selectinload(Question.options),
            selectinload(ExamQuestion.question)
            .selectinload(Question.chapter_questions)
            .selectinload(ChapterQuestion.chapter),
            selectinload(ExamQuestion.question)
            .selectinload(Question.lo_questions)
            .selectinload(LOQuestion.lo),
        )
        .filter(ExamQuestion.exam_id == exam_id)
        .order_by(ExamQuestion.question_id)
        .all()
    )
    return [
        _serialize_question(link, assigned_subjects)
        for link in links
    ]


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
    assigned_subjects = active_subject_ids(db, current_user["school_id"])
    link = (
        db.query(ExamQuestion)
        .options(
            selectinload(ExamQuestion.question).selectinload(Question.options),
            selectinload(ExamQuestion.question)
            .selectinload(Question.chapter_questions)
            .selectinload(ChapterQuestion.chapter),
            selectinload(ExamQuestion.question)
            .selectinload(Question.lo_questions)
            .selectinload(LOQuestion.lo),
        )
        .filter_by(exam_id=exam_id, question_id=question_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Question not found in this exam")
    return _serialize_question(link, assigned_subjects)


@router.get("/get_exam_overview/")
def get_exam_overview(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    teacher = _teacher(db, current_user["school_id"])
    assigned_subjects = active_subject_ids(db, teacher.school_id)
    now = datetime.now()
    active_exams = (
        db.query(Exam)
        .filter(
            Exam.manage_by == teacher.school_id,
            Exam.status == ExamStatus.published,
            Exam.start_time <= now,
            Exam.end_time >= now,
        )
        .order_by(Exam.end_time)
        .all()
    )
    upcoming = (
        db.query(Exam)
        .filter(
            Exam.manage_by == teacher.school_id,
            Exam.status == ExamStatus.published,
            Exam.start_time > now,
        )
        .order_by(Exam.start_time)
        .limit(4)
        .all()
    )
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
        .filter(Subject.subject_id.in_(assigned_subjects))
        .group_by(Subject.subject_id, Subject.subject_name, Subject.subject_description)
        .order_by(Subject.subject_name)
        .limit(50)
        .all()
    )
    return {
        "active_exams": [_serialize_exam(db, exam, now) for exam in active_exams],
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
