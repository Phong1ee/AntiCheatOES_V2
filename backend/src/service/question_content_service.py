from fastapi import HTTPException
from src.a_db_config import QuestionMedia
from src.service.question_media_service import teacher_can_read

CONTENT_FIELDS = ("rich_html", "image_media_id", "audio_media_id", "image_alt")


def content_dict(item):
    return {key: getattr(item, key, None) for key in CONTENT_FIELDS}


def apply_content(target, payload, partial=False):
    if getattr(target, "rich_html", None) is not None and "rich_html" not in payload.model_fields_set and "question_text" in payload.model_fields_set and payload.question_text != target.question_text:
        raise HTTPException(422, "Send rich_html explicitly when replacing a rich question body")
    for key in CONTENT_FIELDS:
        if not partial or key in payload.model_fields_set:
            setattr(target, key, getattr(payload, key))
    if hasattr(target, "semantic_value"):
        target.semantic_value = getattr(payload, "semantic_value", None) or (payload.options_text.lower() if payload.options_text.lower() in {"true", "false"} else None)


def validate_media(db, payload, school_id, subject_id):
    for item in [payload, *(getattr(payload, "options", None) or [])]:
        for kind in ("image", "audio"):
            media_id = getattr(item, kind + "_media_id", None)
            if not media_id:
                continue
            media = db.get(QuestionMedia, media_id)
            if not media or media.subject_id != subject_id or media.kind != kind or not teacher_can_read(db, media, school_id):
                raise HTTPException(422, "Media reference is invalid for this subject or content type")
            # Teacher's subject authorization is checked by the caller before this.


def require_body(payload):
    for option in getattr(payload, "options", None) or []:
        if not (getattr(option, "options_text", "") or "").strip() and not getattr(option, "image_media_id", None) and not getattr(option, "audio_media_id", None):
            raise HTTPException(422, "Each option requires text, an image or audio")
    if not (getattr(payload, "question_text", "") or "").strip() and not payload.image_media_id and not payload.audio_media_id:
        raise HTTPException(422, "Question requires text, an image or audio")


def normalize_existing_content(payload, question):
    """Omitted additive fields retain existing data; explicit NULL removes content.

    A legacy plain-text client cannot silently replace formatted text or media
    options without identifying the option or supplying its content explicitly.
    """
    values = payload.model_dump(exclude_unset=True)
    if question.rich_html is not None and "rich_html" not in payload.model_fields_set:
        text = getattr(payload, "question_text", None)
        if text is not None and text != question.question_text:
            raise HTTPException(422, "Send rich_html explicitly when replacing a rich question body")
    for key in CONTENT_FIELDS:
        if key not in payload.model_fields_set:
            values[key] = getattr(question, key, None)
    requested = getattr(payload, "options", None)
    current = {o.options_id: o for o in question.options}
    if requested is not None:
        if "options" not in payload.model_fields_set and any(o.rich_html or o.image_media_id or o.audio_media_id for o in current.values()):
            values["options"] = [{"options_id": o.options_id, "options_text": o.options_text, "is_correct": o.is_correct, "semantic_value": o.semantic_value, **content_dict(o)} for o in sorted(current.values(), key=lambda o: o.options_id)]
        else:
            normalized = []
            for item in requested:
                option_id = getattr(item, "options_id", None)
                source = current.get(option_id)
                if option_id is not None and source is None:
                    raise HTTPException(400, "An option ID does not belong to this question")
                if source is None and not any(k in item.model_fields_set for k in CONTENT_FIELDS) and any(o.rich_html or o.image_media_id or o.audio_media_id for o in current.values()):
                    raise HTTPException(422, "Rich/media options require option IDs or explicit content when replacing them")
                option_values = item.model_dump(exclude_unset=True)
                if source is not None:
                    if source.rich_html is not None and "rich_html" not in item.model_fields_set and item.options_text != source.options_text:
                        raise HTTPException(422, "Send rich_html explicitly when replacing rich option text")
                    for key in (*CONTENT_FIELDS, "semantic_value"):
                        if key not in item.model_fields_set:
                            option_values[key] = getattr(source, key, None)
                normalized.append(option_values)
            values["options"] = normalized
    return type(payload).model_validate(values)
