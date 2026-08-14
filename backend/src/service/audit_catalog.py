"""Stable display metadata for shared audit actions; unknown legacy actions remain usable."""

from typing import TypedDict


class AuditActionInfo(TypedDict):
    label: str
    category: str
    visible_to_admin: bool


_ACTIONS: dict[str, AuditActionInfo] = {
    "USER_CREATED": {"label": "User Created", "category": "USER_MANAGEMENT", "visible_to_admin": True},
    "USER_UPDATED": {"label": "User Updated", "category": "USER_MANAGEMENT", "visible_to_admin": True},
    "QUESTION_CREATED": {"label": "Question Created", "category": "QUESTION_BANK", "visible_to_admin": True},
    "QUESTION_APPROVED": {"label": "Question Approved", "category": "QUESTION_BANK", "visible_to_admin": True},
    "QUESTION_EDITED": {"label": "Question Edited", "category": "QUESTION_BANK", "visible_to_admin": True},
    "EXAM_CREATED": {"label": "Exam Created", "category": "EXAM_MANAGEMENT", "visible_to_admin": True},
    "EXAM_UPDATED": {"label": "Exam Updated", "category": "EXAM_MANAGEMENT", "visible_to_admin": True},
    "EXAM_PUBLISHED": {"label": "Exam Published", "category": "EXAM_MANAGEMENT", "visible_to_admin": True},
    "EXAM_ASSIGNMENT_UPDATED": {"label": "Exam Assignment Updated", "category": "EXAM_MANAGEMENT", "visible_to_admin": True},
    "RESULT_FINALIZED": {"label": "Result Finalized", "category": "GRADING", "visible_to_admin": True},
    "BULK_DATA_REQUEST_IMPORTED": {"label": "Bulk Request Imported", "category": "BULK_IMPORT", "visible_to_admin": True},
    "QUESTION_IMPORT_COMPLETED": {"label": "Question Import Completed", "category": "BULK_IMPORT", "visible_to_admin": True},
    "USER_IMPORT_COMPLETED": {"label": "User Import Completed", "category": "BULK_IMPORT", "visible_to_admin": True},
    # Retain hidden legacy mappings so historical telemetry rows remain renderable.
    "ANALYTICS_EVENT_RECORDED": {"label": "Analytics Event Recorded", "category": "SYSTEM", "visible_to_admin": False},
    "ANTI_CHEAT_ANALYTICS_RECORDED": {"label": "Anti-Cheat Analytics Recorded", "category": "SYSTEM", "visible_to_admin": False},
    "NOTIFICATION_REQUEST_RECORDED": {"label": "Notification Request Recorded", "category": "SYSTEM", "visible_to_admin": False},
}


def audit_action_info(action: str) -> AuditActionInfo:
    """Return catalog metadata without preventing legacy actions from being displayed."""
    normalized = str(action or "").strip().upper()
    return _ACTIONS.get(normalized, {
        "label": normalized.replace("_", " ").title() or "Unknown Action",
        "category": "SYSTEM",
        "visible_to_admin": True,
    })


def visible_audit_actions() -> list[dict[str, str]]:
    """Expose only user-facing filters while retaining internal rows in storage."""
    return [
        {"code": code, "label": info["label"], "category": info["category"]}
        for code, info in sorted(_ACTIONS.items())
        if info["visible_to_admin"]
    ]


def hidden_audit_actions() -> set[str]:
    return {code for code, info in _ACTIONS.items() if not info["visible_to_admin"]}
