"""Safe, transport-neutral event envelopes shared by later infrastructure phases."""

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


_SENSITIVE_KEY_PARTS = (
    "password",
    "passwd",
    "token",
    "jwt",
    "authorization",
    "cookie",
    "session",
    "media",
    "audio",
    "video",
    "image",
    "biometric",
    "answer",
    "essay",
    "file",
    "xlsx",
    "connection",
    "dsn",
)
_MAX_METADATA_ITEMS = 20
_MAX_METADATA_DEPTH = 3
_MAX_STRING_LENGTH = 512


def _is_sensitive_key(key: object) -> bool:
    normalized = str(key).strip().lower().replace("-", "_")
    return any(part in normalized for part in _SENSITIVE_KEY_PARTS)


def sanitize_metadata(metadata: dict[str, Any] | None, *, _depth: int = 0) -> dict[str, Any]:
    """Keep metadata small and non-sensitive before it reaches durable storage."""
    if not isinstance(metadata, dict) or _depth >= _MAX_METADATA_DEPTH:
        return {}

    sanitized: dict[str, Any] = {}
    for key, value in list(metadata.items())[:_MAX_METADATA_ITEMS]:
        key_text = str(key).strip()[:100]
        if not key_text or _is_sensitive_key(key_text):
            continue
        if isinstance(value, dict):
            sanitized[key_text] = sanitize_metadata(value, _depth=_depth + 1)
        elif isinstance(value, (str, int, float, bool)) or value is None:
            sanitized[key_text] = value[:_MAX_STRING_LENGTH] if isinstance(value, str) else value
        elif isinstance(value, (list, tuple)):
            sanitized[key_text] = [
                item[:_MAX_STRING_LENGTH] if isinstance(item, str) else item
                for item in list(value)[:_MAX_METADATA_ITEMS]
                if isinstance(item, (str, int, float, bool)) or item is None
            ]
    return sanitized


def build_event_envelope(
    *,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str | int,
    metadata: dict[str, Any] | None = None,
    version: int = 1,
    event_id: str | None = None,
    occurred_at: datetime | None = None,
) -> dict[str, Any]:
    """Create the only event shape that later outbox/broker work may publish."""
    if not event_type.strip() or not aggregate_type.strip() or not str(aggregate_id).strip():
        raise ValueError("Event type, aggregate type, and aggregate id are required")
    if version < 1:
        raise ValueError("Event version must be positive")
    timestamp = occurred_at or datetime.now(timezone.utc)
    return {
        "event_id": event_id or str(uuid4()),
        "event_type": event_type.strip()[:100],
        "aggregate_type": aggregate_type.strip()[:50],
        "aggregate_id": str(aggregate_id).strip()[:64],
        "occurred_at": timestamp.astimezone(timezone.utc).isoformat(),
        "version": version,
        "metadata": sanitize_metadata(metadata),
    }
