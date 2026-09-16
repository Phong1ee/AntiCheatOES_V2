from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import get_db
from src.a_db_config import NotificationType
from src.middleware.authMiddleware import STUDENT_ONLY, verify_token
from src.service.notification_service import (
    get_student_notifications,
    get_unread_count,
    mark_all_notifications_read,
    mark_notification_read,
)


router = APIRouter()


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notification_id: int
    exam_id: int | None
    type: NotificationType
    title: str
    message: str
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int


class MarkAllNotificationsReadResponse(BaseModel):
    updated_count: int
    unread_count: int


@router.get("/notifications", response_model=NotificationListResponse)
def get_notifications(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(STUDENT_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    student_id = current_user["school_id"]
    return NotificationListResponse(
        notifications=get_student_notifications(db, student_id),
        unread_count=get_unread_count(db, student_id),
    )


@router.patch("/notifications/read-all", response_model=MarkAllNotificationsReadResponse)
def mark_all_read(
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(STUDENT_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        student_id = current_user["school_id"]
        updated_count = mark_all_notifications_read(db, student_id)
        db.commit()
        return MarkAllNotificationsReadResponse(updated_count=updated_count, unread_count=0)
    except Exception:
        db.rollback()
        raise


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_one_read(
    notification_id: int,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(STUDENT_ONLY),
    db: Session = Depends(get_db),
):
    del role_check
    try:
        notification = mark_notification_read(db, current_user["school_id"], notification_id)
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        db.commit()
        db.refresh(notification)
        return notification
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
