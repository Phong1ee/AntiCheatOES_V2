from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.a_db_config import TeacherSubject
from src.service.cache_service import cache_aside, teacher_subjects_key


def active_subject_ids(db: Session, teacher_school_id: str) -> set[str]:
    """Return Subjects currently assigned to a Teacher's external school ID."""
    def load() -> list[str]:
        return [
            subject_id
            for (subject_id,) in db.query(TeacherSubject.subject_id)
            .filter(
                TeacherSubject.teacher_id == teacher_school_id,
                TeacherSubject.is_active.is_(True),
            )
            .all()
        ]

    return set(cache_aside(teacher_subjects_key(teacher_school_id), 60, load))


def has_active_subject_assignment(
    db: Session,
    teacher_school_id: str,
    subject_id: str | None,
) -> bool:
    if not subject_id:
        return False
    return (
        db.query(TeacherSubject.subject_id)
        .filter(
            TeacherSubject.teacher_id == teacher_school_id,
            TeacherSubject.subject_id == subject_id,
            TeacherSubject.is_active.is_(True),
        )
        .first()
        is not None
    )


def require_active_subject_assignment(
    db: Session,
    teacher_school_id: str,
    subject_id: str | None,
) -> None:
    if not has_active_subject_assignment(db, teacher_school_id, subject_id):
        raise HTTPException(
            status_code=403,
            detail="You are not actively assigned to this subject",
        )
