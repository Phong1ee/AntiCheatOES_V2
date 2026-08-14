"""Transaction-bound shared audit logging."""

from contextvars import ContextVar
from typing import Any

from sqlalchemy.orm import Session

from src.a_db_config import AuditLog
from src.service.event_contract import sanitize_metadata
from src.service.observability_service import current_request_id


_audit_request_context: ContextVar[dict[str, str | None]] = ContextVar(
    "audit_request_context", default={}
)
_ALLOWED_OUTCOMES = {"SUCCESS", "FAILED"}


def begin_audit_request_context(*, client_ip: str | None, user_agent: str | None):
    """Install non-sensitive HTTP fields for audit rows created during this request."""
    return _audit_request_context.set({
        "client_ip": _clean_request_value(client_ip, 45),
        "user_agent": _clean_request_value(user_agent, 512),
    })


def reset_audit_request_context(token) -> None:
    _audit_request_context.reset(token)


def _clean_request_value(value: str | None, limit: int) -> str | None:
    if not value:
        return None
    cleaned = "".join(character for character in str(value).strip() if not character.isspace() or character == " ")
    return cleaned[:limit] or None


def _role_value(role: object | None) -> str | None:
    return role.value if hasattr(role, "value") else (str(role).lower() if role else None)


def record_audit(
    db: Session,
    *,
    actor_school_id: str | None,
    actor_role: object | None,
    action: str,
    entity_type: str,
    entity_id: str | int,
    metadata: dict[str, Any] | None = None,
    request_id: str | None = None,
    outcome: str = "SUCCESS",
) -> AuditLog:
    """Add an audit row to the caller's transaction; this function never commits."""
    if not action.strip() or not entity_type.strip() or not str(entity_id).strip():
        raise ValueError("Audit action, entity type, and entity id are required")
    normalized_outcome = outcome.strip().upper() if isinstance(outcome, str) else ""
    if normalized_outcome not in _ALLOWED_OUTCOMES:
        raise ValueError("Audit outcome must be SUCCESS or FAILED")
    request_context = _audit_request_context.get()
    audit = AuditLog(
        actor_school_id=actor_school_id,
        actor_role=_role_value(actor_role),
        action=action.strip()[:100],
        entity_type=entity_type.strip()[:50],
        entity_id=str(entity_id).strip()[:64],
        metadata_json=sanitize_metadata(metadata),
        request_id=(request_id or current_request_id() or "").strip()[:64] or None,
        outcome=normalized_outcome,
        client_ip=request_context.get("client_ip"),
        user_agent=request_context.get("user_agent"),
    )
    db.add(audit)
    return audit
