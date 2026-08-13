"""Transaction-bound shared audit logging."""

from typing import Any

from sqlalchemy.orm import Session

from src.a_db_config import AuditLog
from src.service.event_contract import sanitize_metadata
from src.service.observability_service import current_request_id


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
) -> AuditLog:
    """Add an audit row to the caller's transaction; this function never commits."""
    if not action.strip() or not entity_type.strip() or not str(entity_id).strip():
        raise ValueError("Audit action, entity type, and entity id are required")
    audit = AuditLog(
        actor_school_id=actor_school_id,
        actor_role=_role_value(actor_role),
        action=action.strip()[:100],
        entity_type=entity_type.strip()[:50],
        entity_id=str(entity_id).strip()[:64],
        metadata_json=sanitize_metadata(metadata),
        request_id=(request_id or current_request_id() or "").strip()[:64] or None,
    )
    db.add(audit)
    return audit
