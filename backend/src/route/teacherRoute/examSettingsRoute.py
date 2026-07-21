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

router = APIRouter()


def _owned_exam(db: Session, exam_id: int, school_id: str) -> Exam:
    exam = (
        db.query(Exam)
        .filter(Exam.exam_id == exam_id, Exam.manage_by == school_id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


def _serialize(setting: ExamSetting) -> ExamSettingsResponse:
    return ExamSettingsResponse(
        exam_id=setting.exam_id,
        shuffle_question=setting.shuffle_question,
        shuffle_answer_options=setting.shuffle_answer_options,
        auto_submit_on_expire=setting.auto_submit_on_expire,
        grace_period=setting.grace_period,
        force_fullscreen_thresh=setting.force_fullscreen_thresh,
        tab_switch_thresh=setting.tab_switch_thresh,
        copy_paste_thresh=setting.copy_paste_thresh,
        auto_grade=setting.auto_grade,
    )


def _apply(setting: ExamSetting, payload: ExamSettingsRequest) -> None:
    for field, value in payload.model_dump().items():
        setattr(setting, field, value)


@router.get("/exams/{exam_id}/settings", response_model=ExamSettingsResponse)
def get_exam_settings(
    exam_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(TEACHER_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    _owned_exam(db, exam_id, current_user["school_id"])
    setting = db.get(ExamSetting, exam_id)
    if setting:
        return _serialize(setting)
    try:
        setting = ExamSetting(exam_id=exam_id)
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return _serialize(setting)
    except IntegrityError:
        # A concurrent GET may have created the one-to-one row first.
        db.rollback()
        setting = db.get(ExamSetting, exam_id)
        if not setting:
            raise HTTPException(status_code=409, detail="Exam settings could not be initialized")
        return _serialize(setting)
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
    if db.get(ExamSetting, exam_id):
        raise HTTPException(status_code=409, detail="Exam settings already exist")
    try:
        setting = ExamSetting(exam_id=exam_id)
        _apply(setting, payload)
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return _serialize(setting)
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
    _owned_exam(db, exam_id, current_user["school_id"])
    setting = db.get(ExamSetting, exam_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Exam settings not found")
    try:
        _apply(setting, payload)
        db.commit()
        db.refresh(setting)
        return _serialize(setting)
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
        return {"success": True, "message": "Exam settings deleted"}
    except Exception:
        db.rollback()
        raise
