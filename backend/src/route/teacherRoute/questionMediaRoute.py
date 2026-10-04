"""Immutable bounded media. Student access is proven by their attempt snapshot."""
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from src.a_db_config import Attempt, AttemptQuestion, QuestionMedia
from src.service.question_media_service import contains_reference, is_referenced, teacher_can_read
from src.middleware.authMiddleware import TEACHER_ONLY, STUDENT_ONLY, verify_token
from src.service.teacher_subject_service import require_active_subject_assignment
from src.route.teacherRoute.questionImageRoute import _sniff_image_type

router = APIRouter()
student_router = APIRouter()


def sniff_media(content):
    image = _sniff_image_type(content)
    if image:
        return "image", image
    if content.startswith(b"RIFF") and content[8:12] == b"WAVE":
        return "audio", "audio/wav"
    if content.startswith(b"OggS") and (b"vorbis" in content[:256] or b"OpusHead" in content[:256]):
        return "audio", "audio/ogg"
    if content.startswith(b"ID3") or (len(content) > 3 and content[0] == 255 and content[1] & 0xE0 == 0xE0 and content[1] & 6 != 0 and content[2] & 0xF0 not in (0, 0xF0)):
        return "audio", "audio/mpeg"
    if content[4:8] == b"ftyp" and any(brand in content[8:32] for brand in (b"M4A ", b"M4B ")):
        return "audio", "audio/mp4"
    raise HTTPException(422, "Upload PNG/JPEG/WebP/GIF or MP3/WAV/OGG/M4A with valid file bytes")


@router.post("/question-media")
async def upload_media(subject_id: str = Query(...), file: UploadFile = File(...), current_user=Depends(verify_token), role_check=Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    require_active_subject_assignment(db, current_user["school_id"], subject_id)
    content = await file.read(10 * 1024 * 1024 + 1)
    if not content:
        raise HTTPException(422, "File is empty")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "Audio must be 10 MB or smaller")
    kind, mime = sniff_media(content)
    if kind == "image" and len(content) > 2 * 1024 * 1024:
        raise HTTPException(413, "Image must be 2 MB or smaller")
    media_id = hashlib.sha256(subject_id.encode() + b":" + content).hexdigest()
    if not db.get(QuestionMedia, media_id):
        db.add(QuestionMedia(media_id=media_id, content=content, mime_type=mime, kind=kind, created_by=current_user["school_id"], subject_id=subject_id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if not db.get(QuestionMedia, media_id):
                raise
    return {"media_id": media_id, "kind": kind, "mime_type": mime, "size": len(content)}


def response(media):
    return Response(media.content, media_type=media.mime_type, headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline"})


@router.get("/question-media/{media_id}")
def teacher_media(media_id: str, current_user=Depends(verify_token), role_check=Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    media = db.get(QuestionMedia, media_id)
    if not media:
        raise HTTPException(404, "Media not found")
    if media.subject_id is not None:
        require_active_subject_assignment(db, current_user["school_id"], media.subject_id)
    if not teacher_can_read(db, media, current_user["school_id"]):
        raise HTTPException(404, "Media not found")
    return response(media)


@router.delete("/question-media/{media_id}")
def delete_staged_media(media_id: str, current_user=Depends(verify_token), role_check=Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    media = db.get(QuestionMedia, media_id)
    if media and media.created_by == current_user["school_id"] and not is_referenced(db, media_id):
        db.delete(media)
        db.commit()
    return {"success": True}


@router.post("/question-media/cleanup-staged")
def cleanup_staged(current_user=Depends(verify_token), role_check=Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    # Delayed cleanup lets a failed save retry without losing uploaded bytes.
    removed = 0
    for media in db.query(QuestionMedia).filter(QuestionMedia.created_by == current_user["school_id"], QuestionMedia.created_at < datetime.now() - timedelta(days=1)).all():
        if not is_referenced(db, media.media_id):
            db.delete(media)
            removed += 1
    db.commit()
    return {"removed": removed}


@student_router.get("/attempts/{attempt_id}/media/{media_id}")
def student_media(attempt_id: int, media_id: str, current_user=Depends(verify_token), role_check=Depends(STUDENT_ONLY), db: Session = Depends(get_db)):
    attempt = db.query(Attempt).filter_by(attempt_id=attempt_id, student_id=current_user["school_id"]).first()
    if not attempt:
        raise HTTPException(404, "Media not found")
    rows = db.query(AttemptQuestion).filter_by(attempt_id=attempt_id).all()
    if not any(contains_reference(getattr(row, c), media_id) for row in rows for c in ("content_snapshot", "options_snapshot", "layout_snapshot")):
        raise HTTPException(404, "Media not found")
    media = db.get(QuestionMedia, media_id)
    if not media:
        raise HTTPException(404, "Media not found")
    return response(media)
