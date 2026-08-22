"""Upload, serve and remove the image attached to a question.

The bytes live in question.question_image (MEDIUMBLOB) and are deliberately not
part of any question JSON: payloads stay small, and the image is fetched only by
the browser rendering it, which can cache it.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session, undefer

from database import get_db
from src.a_db_config import (
    Attempt,
    AttemptQuestion,
    Question,
    StudentExam,
    User,
    UserRole,
)
from src.middleware.authMiddleware import STUDENT_ONLY, TEACHER_ONLY, verify_token
from src.service.teacher_subject_service import require_active_subject_assignment


router = APIRouter()

# Well under MEDIUMBLOB's 16 MB: an exam question is a diagram, not a poster.
MAX_IMAGE_SIZE = 2 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
# Checked against the file's own leading bytes: a caller-supplied content type is
# a claim, not evidence, and these bytes are served back to other users.
_MAGIC_NUMBERS = (
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
)


def _teacher(db: Session, school_id: str) -> User:
    teacher = db.query(User).filter(User.school_id == school_id).first()
    role = teacher.role.value if teacher and hasattr(teacher.role, "value") else getattr(teacher, "role", None)
    if not teacher or role != UserRole.teacher.value:
        raise HTTPException(status_code=403, detail="Teacher role is required")
    return teacher


def _sniff_image_type(content: bytes) -> str | None:
    for prefix, media_type in _MAGIC_NUMBERS:
        if content.startswith(prefix):
            return media_type
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def _question_for_write(db: Session, question_id: int, school_id: str) -> Question:
    question = db.query(Question).filter(Question.question_id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    teacher = _teacher(db, school_id)
    require_active_subject_assignment(db, teacher.school_id, question.subject_id)
    return question


def _image_response(question: Question) -> Response:
    if not question.question_image_mime or not question.question_image:
        raise HTTPException(status_code=404, detail="This question has no image")
    return Response(
        content=question.question_image,
        media_type=question.question_image_mime,
        # Content is immutable per upload; a new upload changes the question's
        # updated_at, which the client uses to bust this.
        headers={"Cache-Control": "private, max-age=300"},
    )


def _load_with_image(db: Session, question_id: int) -> Question | None:
    return (
        db.query(Question)
        .options(undefer(Question.question_image))
        .filter(Question.question_id == question_id)
        .first()
    )


@router.put("/questions/{question_id}/image")
async def upload_question_image(
    question_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    """Attach or replace the question's image."""
    del role_check
    question = _question_for_write(db, question_id, current_user["school_id"])
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty")
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="The image must be 2 MB or smaller")
    media_type = _sniff_image_type(content)
    if media_type is None:
        raise HTTPException(status_code=422, detail="Upload a PNG, JPEG, WebP or GIF image")
    try:
        question.question_image = content
        question.question_image_mime = media_type
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"success": True, "question_id": question_id, "content_type": media_type, "size": len(content)}


@router.delete("/questions/{question_id}/image", status_code=status.HTTP_204_NO_CONTENT)
def delete_question_image(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    question = _question_for_write(db, question_id, current_user["school_id"])
    try:
        question.question_image = None
        question.question_image_mime = None
        db.commit()
    except Exception:
        db.rollback()
        raise
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/questions/{question_id}/image")
def get_question_image_for_teacher(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    question = _load_with_image(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    teacher = _teacher(db, current_user["school_id"])
    require_active_subject_assignment(db, teacher.school_id, question.subject_id)
    return _image_response(question)


student_router = APIRouter()


@student_router.get("/questions/{question_id}/image")
def get_question_image_for_student(
    question_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(STUDENT_ONLY),
    db: Session = Depends(get_db),
):
    """Serve the image only for a question this student was actually served."""
    del role_check
    school_id = current_user["school_id"]
    # Their own attempt is the proof: assignment alone would expose questions
    # from exams they have not started, and from other students' pool draws.
    served = (
        db.query(AttemptQuestion.attempt_id)
        .join(Attempt, Attempt.attempt_id == AttemptQuestion.attempt_id)
        .join(StudentExam, StudentExam.exam_id == Attempt.exam_id)
        .filter(
            AttemptQuestion.question_id == question_id,
            Attempt.student_id == school_id,
            StudentExam.student_id == school_id,
        )
        .first()
    )
    if not served:
        raise HTTPException(status_code=404, detail="Question not found")
    question = _load_with_image(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return _image_response(question)
