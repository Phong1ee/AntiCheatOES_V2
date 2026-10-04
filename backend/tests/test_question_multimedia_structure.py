import asyncio
import io
import json
from itertools import product
from decimal import Decimal
import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.a_db_config import Base, User, Subject, TeacherSubject, Question, Option, Exam, ExamQuestion, ExamSetting, Attempt, AttemptQuestion, QuestionMedia
from src.service.rich_content_service import sanitize_rich
from src.service.question_layout_service import build_layout
from src.models.teacher.requestModel.ExamSettingsRequest import ExamSettingsRequest
from src.route.teacherRoute.questionBankRoute import QuestionBankPayload, create_draft_question, update_question, _validate_submit_payload
from src.route.teacherRoute.questionStructureRoute import StructurePayload, put_structure, preview
from src.route.teacherRoute.questionMediaRoute import upload_media, student_media, sniff_media, delete_staged_media
from src.models.teacher import examModel


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add_all([User(school_id="T", full_name="Teacher", email="teacher@example.test", password_hash="unused", role="teacher"), User(school_id="S", full_name="Student", email="student@example.test", password_hash="unused", role="student"), User(school_id="OTHER", full_name="Other", email="other@example.test", password_hash="unused", role="student"), Subject(subject_id="SUB", subject_name="Subject", subject_description="Test subject")])
    session.flush()
    session.add(TeacherSubject(teacher_id="T", subject_id="SUB", assigned_by="T", is_active=True))
    session.add(Exam(exam_id=1, title="Exam", manage_by="T", subject_id="SUB", duration_minutes=60, total_points=10, passing_score=5, version=1, question_selection_mode="manual"))
    session.add(ExamSetting(exam_id=1, questions_per_page=2))
    session.commit()
    yield session
    session.close()


def media(db, kind):
    id = ("a" if kind == "image" else "b") * 64
    if not db.get(QuestionMedia, id):
        db.add(QuestionMedia(media_id=id, kind=kind, mime_type="image/png" if kind == "image" else "audio/wav", content=b"test", created_by="T", subject_id="SUB"))
        db.commit()
    return id


@pytest.mark.parametrize("text,image,audio", [p for p in product([False, True], repeat=3) if any(p)])
def test_seven_content_combinations_roundtrip(db, text, image, audio):
    content = {"rich_html": "<p><b>Rich</b> α</p>" if text else None, "image_media_id": media(db, "image") if image else None, "audio_media_id": media(db, "audio") if audio else None}
    payload = QuestionBankPayload(question_text="Rich α" if text else "", question_type="MCQ", question_difficulties="easy", subject_id="SUB", **content, options=[{"options_text": "Rich α" if text else "", "is_correct": correct, **content} for correct in [True, False]])
    _validate_submit_payload(payload)
    saved = create_draft_question(payload, {"school_id": "T"}, {}, db)
    assert saved["image_media_id"] == content["image_media_id"]
    assert len(saved["options"]) == 2
    assert saved["options"][0]["audio_media_id"] == content["audio_media_id"]
    assert saved["question_text"] == ("Rich α" if text else "")


def test_empty_body_and_options_rejected():
    with pytest.raises(HTTPException):
        _validate_submit_payload(QuestionBankPayload(question_text="", question_type="MCQ", subject_id="SUB", question_difficulties="easy"))
    with pytest.raises(HTTPException):
        _validate_submit_payload(QuestionBankPayload(question_text="Q", question_type="MCQ", subject_id="SUB", question_difficulties="easy", options=[{"options_text": ""}, {"options_text": "", "is_correct": True}]))


@pytest.mark.parametrize("evil", ["<script>alert(1)</script>", '<svg><script>alert(1)</script></svg>', '<math><mtext><img src=x onerror=alert(1)></mtext></math>', '<iframe src="javascript:alert(1)"></iframe>', '<object data="data:text/html,x"></object>'])
def test_xss_drop_subtrees(evil):
    html, plain = sanitize_rich('<p onclick="evil()" style="background:url(javascript:x)">Safe</p>' + evil)
    assert html == "<p>Safe</p>"
    assert plain == "Safe"


def test_math_and_legacy_literal_text():
    html, plain = sanitize_rich('<span data-math="\\frac{1}{2}" data-display="inline" onclick="evil()"></span>')
    assert 'data-math="\\frac{1}{2}"' in html and "onclick" not in html
    assert plain == r"\frac{1}{2}"
    assert sanitize_rich(None) == (None, None)
    with pytest.raises(ValueError): sanitize_rich('<span data-math="' + "x" * 4001 + '"></span>')


def test_layout_determinism_pins_keep_order_and_no_loss():
    ids = list(range(1, 15))
    members = {1: {"pinned_position": 1}, 2: {"block_id": 9, "structure_order": 0}, 3: {"block_id": 9, "structure_order": 1}}
    blocks = {9: {"block_id": 9, "kind": "parent", "keep_order": True, "keep_together": True}}
    result = build_layout(ids, members, blocks, 3, True, "seed")
    assert result == build_layout(ids, members, blocks, 3, True, "seed")
    assert result[0]["question_id"] == 1 and result[0]["position"] == 1
    assert sorted(r["question_id"] for r in result) == ids
    children = [r for r in result if r["question_id"] in [2, 3]]
    assert [r["question_id"] for r in children] == [2, 3]
    assert children[0]["page"] == children[1]["page"]


def test_conflicting_pin_and_large_block_continuation():
    with pytest.raises(ValueError, match="conflicts"):
        build_layout([1, 2], {1: {"pinned_position": 1}, 2: {"pinned_position": 1}}, questions_per_page=2)
    rows = build_layout([1, 2, 3, 4, 5], {q: {"block_id": 1} for q in range(1, 6)}, {1: {"keep_together": True, "keep_order": True}}, 2)
    assert [r["page"] for r in rows] == [1, 1, 2, 2, 3]
    assert rows[-1]["continuation"]
    with pytest.raises(ValueError): build_layout([1], questions_per_page=0)


def test_settings_range():
    for value in [0, 51, -1]:
        with pytest.raises(ValueError): ExamSettingsRequest(questions_per_page=value)


@pytest.mark.parametrize("kind", ["group", "parent"])
def test_structure_crud_detach_and_preview(db, kind):
    for id in [1, 2, 3]:
        db.add(Question(question_id=id, question_text=f"Q{id}", question_type="essay", subject_id="SUB", created_by="T", question_status="draft"))
        db.add(ExamQuestion(exam_id=1, question_id=id, question_point=Decimal("1")))
    db.commit()
    payload = StructurePayload(expected_version=1, blocks=[{"kind": kind, "title": "Passage", "rich_html": "<b>Read</b>", "question_ids": [1, 2], "pinned_position": 1}], standalone=[{"question_id": 3}])
    result = put_structure(1, payload, {"school_id": "T"}, {}, db)
    first = preview(1, "seed", True, False, {"school_id": "T"}, {}, db)
    second = preview(1, "seed", True, False, {"school_id": "T"}, {}, db)
    assert first == second
    assert first["questions"][0]["layout"]["block"]["title"] == "Passage"
    assert db.query(Attempt).count() == 0
    removed = put_structure(1, StructurePayload(expected_version=result["version"], standalone=[{"question_id": q} for q in [1, 2, 3]]), {"school_id": "T"}, {}, db)
    assert len(removed["layout"]) == 3 and db.query(Question).count() == 3


def test_media_access_is_snapshot_scoped_and_immutable(db):
    ref = media(db, "audio")
    db.add(Question(question_id=1, question_text="Q", question_type="essay", subject_id="SUB", created_by="T", audio_media_id=ref))
    db.add(Attempt(attempt_id=1, exam_id=1, student_id="S", attempt_no=1))
    db.flush()
    db.add(AttemptQuestion(attempt_id=1, question_id=1, content_snapshot={"audio_media_id": ref}, options_snapshot=[], layout_snapshot={"page": 1, "slot": 1}))
    db.commit()
    db.get(Question, 1).audio_media_id = None
    db.commit()
    assert student_media(1, ref, {"school_id": "S"}, {}, db).body == b"test"
    with pytest.raises(HTTPException): student_media(1, ref, {"school_id": "OTHER"}, {}, db)
    with pytest.raises(HTTPException): student_media(1, "c" * 64, {"school_id": "S"}, {}, db)
    delete_staged_media(ref, {"school_id": "T"}, {}, db)
    assert db.get(QuestionMedia, ref) is not None


def test_media_magic_and_size(db):
    for content in [b"<svg></svg>", b"not an mp3", b"RIFF1234FAKE", b""]:
        with pytest.raises(HTTPException): sniff_media(content)
    assert sniff_media(b"RIFF1234WAVEdata")[1] == "audio/wav"
    assert sniff_media(b"\x89PNG\r\n\x1a\n")[0] == "image"
    file = UploadFile(filename="fake.png", file=io.BytesIO(b"<script>x</script>"))
    with pytest.raises(HTTPException): asyncio.run(upload_media("SUB", file, {"school_id": "T"}, {}, db))
    oversized = UploadFile(filename="large.wav", file=io.BytesIO(b"RIFF1234WAVE" + bytes(10 * 1024 * 1024)))
    with pytest.raises(HTTPException) as exc: asyncio.run(upload_media("SUB", oversized, {"school_id": "T"}, {}, db))
    assert exc.value.status_code == 413


def test_sequential_allows_same_page_but_rejects_next_page():
    questions = {q: {"question_id": q, "display_order": q, "layout_snapshot": {"page": 1 if q < 3 else 2}} for q in [1, 2, 3]}
    examModel._validate_sequential_save(questions, set(), 2)
    with pytest.raises(Exception): examModel._validate_sequential_save(questions, set(), 3)


def test_option_shuffle_scores_snapshot_identity():
    class Cursor:
        def execute(self, *args): raise AssertionError("Must not read mutable options")
    q = {"options_snapshot": [{"id": 2, "text": "", "image_media_id": "a" * 64, "isCorrect": False}, {"id": 1, "text": "", "audio_media_id": "b" * 64, "isCorrect": True}]}
    assert examModel._valid_snapshot_option(Cursor(), q, 1)["isCorrect"]
    assert not examModel._valid_snapshot_option(Cursor(), q, 2)["isCorrect"]


def test_structure_conflict_rolls_back_version_and_membership(db):
    for qid in [1, 2]:
        db.add(Question(question_id=qid, question_text="Q", question_type="essay", subject_id="SUB", created_by="T"))
        db.add(ExamQuestion(exam_id=1, question_id=qid, question_point=1))
    db.commit()
    bad = StructurePayload(expected_version=1, standalone=[{"question_id": 1, "pinned_position": 1}, {"question_id": 2, "pinned_position": 1}])
    with pytest.raises(HTTPException) as exc:
        put_structure(1, bad, {"school_id": "T"}, {}, db)
    assert exc.value.status_code == 409
    assert db.get(Exam, 1).version == 1
    assert all(r.pinned_position is None for r in db.query(ExamQuestion).all())
    with pytest.raises(HTTPException):
        put_structure(1, bad, {"school_id": "OTHER"}, {}, db)


def test_clone_preserves_media_only_options_and_rich_body(db):
    from src.route.teacherRoute.addQuestionsRoute import _clone_question
    from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
    ref = media(db, "image")
    source = Question(question_text="Rich", rich_html="<b>Rich</b>", question_type="MCQ", question_difficulties="easy", subject_id="SUB", created_by="T")
    db.add(source); db.flush()
    db.add_all([Option(question_id=source.question_id, options_text="", image_media_id=ref, is_correct=True), Option(question_id=source.question_id, options_text="Text option", is_correct=False)])
    db.commit()
    clone = _clone_question(db, source, "T", QuestionUpdateRequest(question_point=1), [], [])
    db.flush(); db.refresh(clone)
    assert clone.rich_html == source.rich_html
    assert clone.options[0].options_text == "" and clone.options[0].image_media_id == ref
    assert clone.options[1].options_text == "Text option"


def test_true_false_media_has_explicit_semantics(db):
    ref = media(db, "audio")
    payload = QuestionBankPayload(question_text="Q", question_type="true-false", question_difficulties="easy", subject_id="SUB", options=[{"options_text": "", "audio_media_id": ref, "semantic_value": "true", "is_correct": True}, {"options_text": "", "audio_media_id": ref, "semantic_value": "false", "is_correct": False}])
    _validate_submit_payload(payload)
    saved = create_draft_question(payload, {"school_id": "T"}, {}, db)
    assert {o["semantic_value"] for o in saved["options"]} == {"true", "false"}


def test_changing_page_size_rejects_shifted_pin(db):
    from src.route.teacherRoute.examSettingsRoute import update_exam_settings
    for qid in [1, 2]:
        db.add(Question(question_id=qid, question_text="Q", question_type="essay", subject_id="SUB", created_by="T"))
        db.add(ExamQuestion(exam_id=1, question_id=qid, question_point=1, pinned_position=2 if qid == 2 else None))
    db.commit()
    with pytest.raises(HTTPException) as exc:
        update_exam_settings(1, ExamSettingsRequest(questions_per_page=1, expected_version=1), {"school_id": "T"}, {}, db)
    assert exc.value.status_code == 409
    assert db.get(ExamSetting, 1).questions_per_page == 2 and db.get(Exam, 1).version == 1


def test_unstarted_exam_does_not_return_mutable_questions():
    from unittest.mock import patch
    from src.controller.teacherController.examController import ExamController
    with patch.object(examModel, "getAssignedExamById", return_value={"exam_id": 1}), patch.object(examModel, "getExamQuestions") as load:
        result = ExamController.getExamWithQuestions("S", "student", 1)
    assert result["questions"] == []
    load.assert_not_called()


def test_deep_math_html_is_bounded():
    with pytest.raises(ValueError):
        sanitize_rich("<div>" * 101 + "x" + "</div>" * 101)


def test_partial_request_does_not_erase_unspecified_rich_content():
    from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
    from src.service.question_content_service import apply_content
    target = Question(question_text="Rich", rich_html="<b>Rich</b>")
    request = QuestionUpdateRequest(question_point=2)
    assert "rich_html" not in request.model_fields_set
    apply_content(target, request, partial=True)
    assert target.rich_html == "<b>Rich</b>"


def test_empty_option_create_is_rejected_and_rolls_back(db):
    payload = QuestionBankPayload(question_text="Q", question_type="MCQ", subject_id="SUB", options=[{"options_text": ""}])
    with pytest.raises(HTTPException):
        create_draft_question(payload, {"school_id": "T"}, {}, db)
    assert db.query(Question).count() == 0 and db.query(Option).count() == 0


def test_legacy_update_cannot_silently_replace_rich_body():
    from src.models.teacher.requestModel.QuestionUpdateRequest import QuestionUpdateRequest
    from src.service.question_content_service import apply_content
    target = Question(question_text="Rich", rich_html="<b>Rich</b>")
    with pytest.raises(HTTPException):
        apply_content(target, QuestionUpdateRequest(question_text="Replacement", question_point=1), partial=True)
    assert target.rich_html == "<b>Rich</b>"


def test_editor_formula_plain_representation_is_not_duplicated():
    html, plain = sanitize_rich('<p>Value <span data-math="x^2">x^2</span></p>')
    assert plain == 'Value x^2'
    assert sanitize_rich(html) == (html, plain)


def test_children_shuffle_only_when_teacher_allows_it():
    ids = [1, 2, 3, 4]
    members = {qid: {"block_id": 7, "structure_order": qid} for qid in ids}
    fixed = {7: {"kind": "group", "keep_order": True, "keep_together": True, "pinned_position": 1}}
    loose = {7: {**fixed[7], "keep_order": False}}
    fixed_orders = {tuple(row["question_id"] for row in build_layout(ids, members, fixed, 4, True, str(seed))) for seed in range(10)}
    loose_orders = {tuple(row["question_id"] for row in build_layout(ids, members, loose, 4, True, str(seed))) for seed in range(10)}
    assert fixed_orders == {(1, 2, 3, 4)} and len(loose_orders) > 1
    assert all(sorted(order) == ids for order in loose_orders)


def test_subject_permission_does_not_expose_other_teachers_private_media(db):
    from src.route.teacherRoute.questionMediaRoute import teacher_media
    db.add(User(school_id="T2", full_name="Teacher 2", email="t2@example.test", password_hash="unused", role="teacher")); db.flush()
    db.add(TeacherSubject(teacher_id="T2", subject_id="SUB", assigned_by="T", is_active=True)); db.commit()
    ref = media(db, "audio")
    assert teacher_media(ref, {"school_id": "T"}, {}, db).body == b"test"
    with pytest.raises(HTTPException) as exc:
        teacher_media(ref, {"school_id": "T2"}, {}, db)
    assert exc.value.status_code == 404
    question = Question(question_text="Private", question_type="essay", subject_id="SUB", created_by="T", question_status="draft", audio_media_id=ref)
    db.add(question); db.commit()
    with pytest.raises(HTTPException): teacher_media(ref, {"school_id": "T2"}, {}, db)
    question.question_status = "approved"; db.commit()
    assert teacher_media(ref, {"school_id": "T2"}, {}, db).body == b"test"


def test_private_media_cannot_be_claimed_by_another_teachers_question(db):
    from src.service.question_content_service import validate_media
    ref = media(db, "audio")
    payload = QuestionBankPayload(question_text="Q", question_type="essay", subject_id="SUB", audio_media_id=ref)
    with pytest.raises(HTTPException): validate_media(db, payload, "T2", "SUB")
    assert db.query(Question).count() == 0


def test_legacy_ownerless_media_remains_snapshot_readable_without_fake_ownership(db):
    from src.route.teacherRoute.questionMediaRoute import teacher_media
    ref = 'd' * 64
    db.add(QuestionMedia(media_id=ref, kind="image", mime_type="image/png", content=b"legacy", created_by=None, subject_id=None))
    db.add(Question(question_id=1, question_text="Legacy", question_type="essay", subject_id=None, created_by="T", question_status="draft", image_media_id=ref))
    db.add(Attempt(attempt_id=1, exam_id=1, student_id="S", attempt_no=1)); db.flush()
    db.add(AttemptQuestion(attempt_id=1, question_id=1, content_snapshot={"image_media_id": ref}, layout_snapshot={"page": 1}, options_snapshot=[])); db.commit()
    assert student_media(1, ref, {"school_id": "S"}, {}, db).body == b"legacy"
    assert teacher_media(ref, {"school_id": "T"}, {}, db).body == b"legacy"
    with pytest.raises(HTTPException): teacher_media(ref, {"school_id": "OTHER"}, {}, db)
    assert db.get(QuestionMedia, ref).created_by is None


def test_legacy_metadata_update_preserves_rich_and_media_on_body_and_options(db):
    ref = media(db, "image")
    q = Question(question_text="Rich", rich_html="<b>Rich</b>", image_media_id=ref, question_type="MCQ", question_difficulties="easy", subject_id="SUB", created_by="T", question_status="draft")
    db.add(q); db.flush()
    db.add_all([Option(question_id=q.question_id, options_text="A", rich_html="<u>A</u>", image_media_id=ref, is_correct=True), Option(question_id=q.question_id, options_text="B", is_correct=False)])
    db.commit(); db.refresh(q)
    payload = QuestionBankPayload(question_text="Rich", question_type="MCQ", question_difficulties="hard", subject_id="SUB", options=[{"options_id": o.options_id, "options_text": o.options_text, "is_correct": o.is_correct} for o in q.options])
    saved = update_question(q.question_id, payload, {"school_id": "T"}, {}, db, None)
    assert saved["rich_html"] == "<b>Rich</b>" and saved["image_media_id"] == ref
    assert saved["options"][0]["rich_html"] == "<u>A</u>" and saved["options"][0]["image_media_id"] == ref


def test_legacy_option_replacement_requires_explicit_rich_identity(db):
    from src.service.question_content_service import normalize_existing_content
    q = Question(question_text="Q", question_type="MCQ", subject_id="SUB", created_by="T")
    db.add(q); db.flush()
    db.add(Option(question_id=q.question_id, options_text="A", rich_html="<b>A</b>", is_correct=True)); db.commit(); db.refresh(q)
    payload = QuestionBankPayload(question_text="Q", question_type="MCQ", subject_id="SUB", options=[{"options_text": "Changed", "is_correct": True}])
    with pytest.raises(HTTPException): normalize_existing_content(payload, q)
    assert q.options[0].rich_html == "<b>A</b>"


def test_omitted_page_size_in_settings_update_preserves_pinned_layout(db):
    from src.route.teacherRoute.examSettingsRoute import update_exam_settings
    for qid in (1, 2, 3):
        db.add(Question(question_id=qid, question_text="Q", question_type="essay", subject_id="SUB", created_by="T", question_status="draft"))
        db.add(ExamQuestion(exam_id=1, question_id=qid, question_point=Decimal("1"), pinned_position=3 if qid == 3 else None))
    db.commit()
    result = update_exam_settings(1, ExamSettingsRequest(shuffle_question=True, expected_version=1), {"school_id": "T"}, {}, db)
    assert result.questions_per_page == 2
    assert db.get(ExamQuestion, (1, 3)).pinned_position == 3
