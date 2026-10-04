from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from src.a_db_config import Exam, ExamSetting
from src.middleware.authMiddleware import TEACHER_ONLY, verify_token
from src.models.teacher.requestModel.ExamSettingsRequest import (
    ExamSettingsRequest,
    ExamSettingsResponse,
)
from src.models.teacher.antiCheatPolicy import normalize_anti_cheat_measures
from src.service.result_strategy_service import set_result_strategy, sync_final_scores
from src.service.exam_version_service import claim_exam_version
from src.service.teacher_subject_service import require_active_subject_assignment
from src.service.cache_invalidation_contract import deliver_invalidation, teacher_exam_updated

router = APIRouter()


def _owned_exam(db: Session, exam_id: int, school_id: str) -> Exam:
    exam = (
        db.query(Exam)
        .filter(Exam.exam_id == exam_id, Exam.manage_by == school_id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    require_active_subject_assignment(db, school_id, exam.subject_id)
    return exam


def _serialize(setting: ExamSetting, exam: Exam) -> ExamSettingsResponse:
    return ExamSettingsResponse(
        exam_id=setting.exam_id,
        questions_per_page=setting.questions_per_page,
        shuffle_question=setting.shuffle_question,
        shuffle_answer_options=setting.shuffle_answer_options,
        sequential_navigation=setting.sequential_navigation,
        auto_submit_on_expire=setting.auto_submit_on_expire,
        grace_period=setting.grace_period,
        anti_cheat_enabled=setting.anti_cheat_enabled,
        violation_limit=setting.violation_limit,
        anti_cheat_measures=normalize_anti_cheat_measures(
            setting.anti_cheat_measures, setting.violation_limit,
        ),
        auto_grade=setting.auto_grade,
        result_strategy=setting.result_strategy,
        result_visibility=exam.result_visibility.value if exam.result_visibility else None,
        version=exam.version,
    )


def _apply(setting: ExamSetting, payload: ExamSettingsRequest) -> None:
    for field, value in payload.model_dump(exclude_none=True).items():
        if field in {"expected_version", "result_visibility"}:
            continue
        # Skip request fields with no exam_setting column (setattr would silently succeed).
        if hasattr(type(setting), field):
            setattr(setting, field, value)


@router.get("/exams/{exam_id}/settings", response_model=ExamSettingsResponse)
def get_exam_settings(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    exam = _owned_exam(db, exam_id, current_user["school_id"])
    setting = db.get(ExamSetting, exam_id)
    if setting:
        return _serialize(setting, exam)
    try:
        setting = ExamSetting(exam_id=exam_id)
        db.add(setting)
        db.flush()
        sync_final_scores(db, exam)
        db.commit()
        deliver_invalidation(teacher_exam_updated(exam_id))
        db.refresh(setting)
        return _serialize(setting, exam)
    except IntegrityError:
        # A concurrent GET may have created the one-to-one row first.
        db.rollback()
        setting = db.get(ExamSetting, exam_id)
        if not setting:
            raise HTTPException(status_code=409, detail="Exam settings could not be initialized")
        return _serialize(setting, exam)
    except Exception:
        db.rollback()
        raise


@router.post(
    "/exams/{exam_id}/settings",
    response_model=ExamSettingsResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_exam_settings(
    exam_id: int,
    payload: ExamSettingsRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _owned_exam(db, exam_id, current_user["school_id"])
    exam = claim_exam_version(db, exam_id, current_user["school_id"], payload.expected_version)
    if db.get(ExamSetting, exam_id):
        raise HTTPException(status_code=409, detail="Exam settings already exist")
    try:
        setting = ExamSetting(exam_id=exam_id)
        _apply(setting, payload)
        db.add(setting)
        db.flush()
        sync_final_scores(db, exam)
        db.commit()
        deliver_invalidation(teacher_exam_updated(exam_id))
        db.refresh(setting)
        return _serialize(setting, exam)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Exam settings already exist") from exc
    except Exception:
        db.rollback()
        raise


@router.put("/exams/{exam_id}/settings", response_model=ExamSettingsResponse)
def update_exam_settings(
    exam_id: int,
    payload: ExamSettingsRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    # Keep the existing not-found contract for an unowned settings resource.
    _owned_exam(db, exam_id, current_user["school_id"])
    exam = claim_exam_version(db, exam_id, current_user["school_id"], payload.expected_version)
    setting = db.get(ExamSetting, exam_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Exam settings not found")
    try:
        from .questionStructureRoute import validate_structure
        next_page_size = payload.questions_per_page if payload.questions_per_page is not None else setting.questions_per_page
        next_layout = validate_structure(db, exam_id, next_page_size)
        if setting.questions_per_page != next_page_size:
            old_layout = {r["question_id"]: r for r in validate_structure(db, exam_id)}
            from src.a_db_config import ExamQuestion, ExamQuestionBlock
            pinned_ids = {r.question_id for r in db.query(ExamQuestion).filter_by(exam_id=exam_id).all() if r.pinned_position is not None}
            pinned_blocks = {r.block_id for r in db.query(ExamQuestionBlock).filter_by(exam_id=exam_id).all() if r.pinned_position is not None}
            for row in next_layout:
                if row["question_id"] in pinned_ids or (row.get("block") or {}).get("block_id") in pinned_blocks:
                    old = old_layout[row["question_id"]]
                    if (old["page"], old["slot"]) != (row["page"], row["slot"]):
                        raise ValueError("Questions per page changes a pinned page/slot; unpin or reposition the block first")
        previous_strategy = setting.result_strategy
        _apply(setting, payload)
        if payload.result_visibility is not None:
            exam.result_visibility = payload.result_visibility
        if setting.result_strategy != previous_strategy:
            set_result_strategy(db, exam, setting.result_strategy)
        else:
            db.flush()
        db.commit()
        deliver_invalidation(teacher_exam_updated(exam_id))
        db.refresh(setting)
        return _serialize(setting, exam)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Exam settings could not be updated") from exc
    except Exception:
        db.rollback()
        raise


@router.delete("/exams/{exam_id}/settings")
def delete_exam_settings(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _owned_exam(db, exam_id, current_user["school_id"])
    setting = db.get(ExamSetting, exam_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Exam settings not found")
    try:
        db.delete(setting)
        db.commit()
        deliver_invalidation(teacher_exam_updated(exam_id))
        return {"success": True, "message": "Exam settings deleted"}
    except Exception:
        db.rollback()
        raise
