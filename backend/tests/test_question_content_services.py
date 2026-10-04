from itertools import product
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import Field, ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.a_db_config import Base, Question, Option, QuestionMedia
from src.models.teacher.requestModel.RichContentRequest import RichContentRequest
from src.service.question_content_service import apply_content, require_body, validate_media, normalize_existing_content
from src.service.question_media_service import teacher_can_read, is_referenced


class OptionPayload(RichContentRequest):
    options_id: int | None = None
    options_text: str = ""
    is_correct: bool = False


class QuestionPayload(RichContentRequest):
    question_text: str = ""
    options: list[OptionPayload] = Field(default_factory=list)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.mark.parametrize("text,image,audio", [v for v in product([False, True], repeat=3) if any(v)])
def test_seven_body_and_option_combinations(text, image, audio):
    content = dict(rich_html="<p>Hello <b>α</b></p>" if text else None,
                   image_media_id="a" * 64 if image else None,
                   audio_media_id="b" * 64 if audio else None)
    payload = QuestionPayload(**content, options=[OptionPayload(**content)])
    require_body(payload)
    restored = QuestionPayload.model_validate(payload.model_dump())
    assert restored == payload
    assert payload.question_text == ("Hello α" if text else "")
    assert payload.options[0].options_text == payload.question_text


@pytest.mark.parametrize("payload", [QuestionPayload(), QuestionPayload(question_text="Q", options=[OptionPayload()])])
def test_empty_body_or_option_rejected(payload):
    with pytest.raises(HTTPException) as error:
        require_body(payload)
    assert error.value.status_code == 422


def test_request_sanitizes_xss_and_retains_math():
    payload = QuestionPayload(rich_html='<p onclick="bad()" style="color:red">Safe</p><svg><script>bad()</script></svg><span data-math="x^2" onmouseover="bad()"></span>')
    assert payload.question_text == "Safe\nx^2"
    assert "onclick" not in payload.rich_html and "style=" not in payload.rich_html
    assert "script" not in payload.rich_html and "svg" not in payload.rich_html
    assert 'data-math="x^2"' in payload.rich_html


@pytest.mark.parametrize("content", [dict(image_media_id="bad"), dict(semantic_value="yes"), dict(rich_html="x" * 60001)])
def test_invalid_content_contract(content):
    with pytest.raises(ValidationError):
        RichContentRequest(**content)


def test_apply_preserves_true_false_semantic_identity():
    target = Option(options_text="", is_correct=False)
    apply_content(target, OptionPayload(options_text="True", rich_html="<b>True</b>", audio_media_id="b" * 64))
    assert target.semantic_value == "true"
    assert target.rich_html == "<b>True</b>"
    assert target.audio_media_id == "b" * 64


def existing_question():
    return SimpleNamespace(question_text="Original", rich_html="<b>Original</b>", image_media_id="a" * 64,
                           audio_media_id=None, image_alt="Diagram", options=[])


def test_legacy_edit_cannot_silently_remove_rich_content():
    with pytest.raises(HTTPException) as error:
        normalize_existing_content(QuestionPayload(question_text="Changed"), existing_question())
    assert error.value.status_code == 422


def test_omitted_media_retained_and_explicit_null_removes():
    normalized = normalize_existing_content(QuestionPayload(question_text="Original"), existing_question())
    assert normalized.image_media_id == "a" * 64
    assert normalized.rich_html == "<b>Original</b>"
    cleared = normalize_existing_content(QuestionPayload(question_text="Original", image_media_id=None), existing_question())
    assert cleared.image_media_id is None


def test_option_ids_must_belong_to_question():
    with pytest.raises(HTTPException) as error:
        normalize_existing_content(QuestionPayload(question_text="Original", options=[OptionPayload(options_id=42, options_text="Answer")]), existing_question())
    assert error.value.status_code == 400


def test_media_permissions_and_reference_validation(db):
    media = QuestionMedia(media_id="a" * 64, kind="image", content=b"fixture", mime_type="image/png", created_by="T", subject_id="SUB")
    db.add(media)
    db.commit()
    assert teacher_can_read(db, media, "T")
    assert not teacher_can_read(db, media, "OTHER")
    payload = QuestionPayload(image_media_id=media.media_id)
    validate_media(db, payload, "T", "SUB")
    for teacher, subject in [("OTHER", "SUB"), ("T", "OTHER")]:
        with pytest.raises(HTTPException):
            validate_media(db, payload, teacher, subject)
    with pytest.raises(HTTPException):
        validate_media(db, QuestionPayload(audio_media_id=media.media_id), "T", "SUB")
    assert not is_referenced(db, media.media_id)
    db.add(Question(question_id=1, question_text="", question_type="essay", question_status="draft", created_by="T", subject_id="SUB", image_media_id=media.media_id))
    db.commit()
    assert is_referenced(db, media.media_id)
    assert not teacher_can_read(db, media, "OTHER")
    db.get(Question, 1).question_status = "approved"
    db.commit()
    assert teacher_can_read(db, media, "OTHER")
