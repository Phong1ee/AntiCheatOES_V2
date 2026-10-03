"""Media references and visibility shared by reads, writes and cleanup."""
import json
from src.a_db_config import Question, Option, ExamQuestionBlock, QuestionRevision, AttemptQuestion, Attempt, Exam


def contains_reference(value, media_id):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return False
    if isinstance(value, dict):
        return any((k in {"image_media_id", "audio_media_id"} and v == media_id) or contains_reference(v, media_id) for k, v in value.items())
    if isinstance(value, list):
        return any(contains_reference(v, media_id) for v in value)
    return False


def is_referenced(db, media_id):
    for model in (Question, Option, ExamQuestionBlock):
        if db.query(model).filter((model.image_media_id == media_id) | (model.audio_media_id == media_id)).first():
            return True
    for model, columns in ((AttemptQuestion, ("content_snapshot", "options_snapshot", "layout_snapshot")), (QuestionRevision, ("content_snapshot", "options_snapshot"))):
        for row in db.query(model).all():
            if any(contains_reference(getattr(row, c), media_id) for c in columns):
                return True
    return False


def teacher_can_read(db, media, school_id):
    if media.created_by == school_id:
        return True  # Own staged uploads and immutable historical versions.
    visible = (Question.created_by == school_id) | (Question.question_status == "approved")
    if db.query(Question).filter(visible, (Question.image_media_id == media.media_id) | (Question.audio_media_id == media.media_id)).first():
        return True
    if db.query(Option).join(Question).filter(visible, (Option.image_media_id == media.media_id) | (Option.audio_media_id == media.media_id)).first():
        return True
    if db.query(ExamQuestionBlock).join(Exam).filter(Exam.manage_by == school_id, (ExamQuestionBlock.image_media_id == media.media_id) | (ExamQuestionBlock.audio_media_id == media.media_id)).first():
        return True
    for revision in db.query(QuestionRevision).filter_by(edited_by=school_id).all():
        if any(contains_reference(getattr(revision, c), media.media_id) for c in ("content_snapshot", "options_snapshot")):
            return True
    for row in db.query(AttemptQuestion).join(Attempt).join(Exam).filter(Exam.manage_by == school_id).all():
        if any(contains_reference(getattr(row, c), media.media_id) for c in ("content_snapshot", "options_snapshot", "layout_snapshot")):
            return True
    return False


