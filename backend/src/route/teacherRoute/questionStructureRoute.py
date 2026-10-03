from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from src.a_db_config import ExamQuestion, ExamQuestionBlock, ExamSetting, Question, ExamPoolConfig, ExamPoolRule, ExamPoolQuestion
from src.models.teacher.requestModel.RichContentRequest import RichContentRequest
from src.middleware.authMiddleware import verify_token, TEACHER_ONLY
from src.service.question_layout_service import build_layout
from src.service.rich_content_service import sanitize_rich
from src.service.question_content_service import content_dict, validate_media
from src.service.exam_version_service import claim_exam_version
from src.service.cache_invalidation_contract import deliver_invalidation, teacher_exam_updated
from src.route.teacherRoute.examSettingsRoute import _owned_exam
from src.service.exam_pool_service import seeded_random, select_unique_candidates

router = APIRouter()


class BlockPayload(RichContentRequest):
    block_id: int | None = None
    kind: Literal["group", "parent"]
    title: str = Field(default="", max_length=300)
    question_ids: list[int] = Field(min_length=1, max_length=1000)
    keep_order: bool = True
    keep_together: bool = True
    pinned_position: int | None = Field(default=None, ge=1, le=50000)


class Placement(BaseModel):
    question_id: int
    pinned_position: int | None = Field(default=None, ge=1, le=50000)


class StructurePayload(BaseModel):
    expected_version: int = Field(ge=1)
    blocks: list[BlockPayload] = Field(default_factory=list, max_length=1000)
    standalone: list[Placement] = Field(default_factory=list, max_length=1000)


def structure_data(db, exam_id):
    links = db.query(ExamQuestion).filter_by(exam_id=exam_id).order_by(ExamQuestion.structure_order, ExamQuestion.question_id).all()
    blocks = db.query(ExamQuestionBlock).filter_by(exam_id=exam_id).order_by(ExamQuestionBlock.structure_order).all()
    members = {r.question_id: {"block_id": r.block_id, "structure_order": r.structure_order, "pinned_position": r.pinned_position} for r in links}
    block_map = {r.block_id: {"block_id": r.block_id, "kind": r.kind, "title": r.title, **content_dict(r), "keep_order": r.keep_order, "keep_together": r.keep_together, "pinned_position": r.pinned_position, "structure_order": r.structure_order} for r in blocks}
    return links, members, block_map


def validate_structure(db, exam_id, questions_per_page=None):
    links, members, blocks = structure_data(db, exam_id)
    setting = db.get(ExamSetting, exam_id)
    return build_layout([r.question_id for r in links], members, blocks, questions_per_page or (setting.questions_per_page if setting else 1))


@router.get("/exams/{exam_id}/question-structure")
def get_structure(exam_id: int, current_user=Depends(verify_token), role_check=Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    exam = _owned_exam(db, exam_id, current_user["school_id"])
    links, members, blocks = structure_data(db, exam_id)
    return {"version": exam.version, "blocks": [{**b, "question_ids": [r.question_id for r in links if r.block_id == bid]} for bid, b in blocks.items()], "standalone": [{"question_id": r.question_id, "pinned_position": r.pinned_position} for r in links if r.block_id is None], "layout": validate_structure(db, exam_id)}


@router.put("/exams/{exam_id}/question-structure")
def put_structure(exam_id: int, payload: StructurePayload, current_user=Depends(verify_token), role_check=Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    try:
        exam = _owned_exam(db, exam_id, current_user["school_id"])
        mode = exam.question_selection_mode.value if hasattr(exam.question_selection_mode, "value") else exam.question_selection_mode
        if mode == "pool" and payload.blocks:
            raise HTTPException(409, "A dynamic pool cannot guarantee all children of a block. Materialize a fixed draw before grouping.")
        exam = claim_exam_version(db, exam_id, current_user["school_id"], payload.expected_version)
        links, _, existing = structure_data(db, exam_id)
        by_id = {r.question_id: r for r in links}
        requested = [q for b in payload.blocks for q in b.question_ids] + [r.question_id for r in payload.standalone]
        if len(requested) != len(set(requested)) or set(requested) != set(by_id):
            raise HTTPException(409, "Structure must contain every exam question exactly once")
        block_ids = [b.block_id for b in payload.blocks if b.block_id is not None]
        if len(block_ids) != len(set(block_ids)) or not set(block_ids).issubset(existing):
            raise HTTPException(409, "Block IDs are duplicated or belong to another exam")
        for r in links:
            r.block_id = None
            r.pinned_position = None
        db.flush()
        keep = set()
        for index, item in enumerate(payload.blocks):
            if item.kind == "parent" and not (sanitize_rich(item.rich_html)[1] or item.image_media_id or item.audio_media_id):
                raise HTTPException(422, "Parent stimulus requires rich text, an image or audio")
            validate_media(db, item, current_user["school_id"], exam.subject_id)
            block = db.get(ExamQuestionBlock, item.block_id) if item.block_id else ExamQuestionBlock(exam_id=exam_id)
            for key in ("kind", "title", "keep_order", "keep_together", "pinned_position", "rich_html", "image_media_id", "audio_media_id", "image_alt"):
                setattr(block, key, getattr(item, key))
            block.structure_order = index
            db.add(block)
            db.flush()
            keep.add(block.block_id)
            for child_index, qid in enumerate(item.question_ids):
                by_id[qid].block_id = block.block_id
                by_id[qid].structure_order = child_index
        for index, item in enumerate(payload.standalone, len(payload.blocks)):
            by_id[item.question_id].structure_order = index
            by_id[item.question_id].pinned_position = item.pinned_position
        for bid in set(existing) - keep:
            db.delete(db.get(ExamQuestionBlock, bid))  # only the container; answers/questions survive
        db.flush()
        layout = validate_structure(db, exam_id)
        db.commit()
        deliver_invalidation(teacher_exam_updated(exam_id))
        return {"version": exam.version, "layout": layout}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except Exception:
        db.rollback()
        raise


@router.get("/exams/{exam_id}/question-preview")
def preview(exam_id: int, seed: str = Query(default="preview-1", max_length=100), shuffle: bool | None = None, shuffle_options: bool | None = None, current_user=Depends(verify_token), role_check=Depends(TEACHER_ONLY), db: Session = Depends(get_db)):
    exam = _owned_exam(db, exam_id, current_user["school_id"])
    links, members, blocks = structure_data(db, exam_id)
    ids = [r.question_id for r in links]
    points = {r.question_id: float(r.question_point) for r in links}
    if str(getattr(exam.question_selection_mode, "value", exam.question_selection_mode)) == "pool":
        config = db.query(ExamPoolConfig).filter_by(exam_id=exam_id).first()
        if not config:
            raise HTTPException(409, "Save a valid pool configuration before previewing")
        rules = db.query(ExamPoolRule).filter_by(pool_config_id=config.pool_config_id).all()
        candidates = {r.rule_id: [q.question_id for q in db.query(ExamPoolQuestion).filter_by(rule_id=r.rule_id).all()] for r in rules}
        chosen = select_unique_candidates(candidates, {r.rule_id: r.draw_count for r in rules}, seeded_random(exam_id, seed, config.version))
        ids = [q for rid in sorted(chosen) for q in chosen[rid]]
        points = {q: float(r.max_score_per_question) for r in rules for q in chosen[r.rule_id]}
    settings = db.get(ExamSetting, exam_id)
    layout = build_layout(ids, members, blocks, settings.questions_per_page if settings else 1, shuffle if shuffle is not None else bool(settings and settings.shuffle_question), seed)
    questions = []
    for row in layout:
        q = db.get(Question, row["question_id"])
        options = [{"id": o.options_id, "text": o.options_text, "semantic_value": o.semantic_value, **content_dict(o)} for o in sorted(q.options, key=lambda o: o.options_id)]
        if shuffle_options if shuffle_options is not None else bool(settings and settings.shuffle_answer_options):
            seeded_random(seed, q.question_id, "option-order").shuffle(options)
        questions.append({"id": q.question_id, "text": q.question_text, **content_dict(q), "type": "multiple-choice" if str(getattr(q.question_type, "value", q.question_type)) == "MCQ" else str(getattr(q.question_type, "value", q.question_type)), "points": points[q.question_id], "options": options, "layout": row})
    return {"seed": seed, "questions": questions, "questions_per_page": settings.questions_per_page if settings else 1}
