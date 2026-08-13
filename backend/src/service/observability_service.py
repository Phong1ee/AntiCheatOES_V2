"""Small, dependency-free JSON observability helpers shared by API and workers."""

import json
import logging
from contextvars import ContextVar
from time import perf_counter
from typing import Any


_context: ContextVar[dict[str, Any]] = ContextVar("observability_context", default={})
_logger = logging.getLogger("oes.observability")

_ALLOWED_FIELDS = {
    "request_id", "event_id", "event_type", "role", "school_id", "route",
    "exam_id", "attempt_id", "job_id", "status", "latency_ms", "queue", "outbox_event_id",
}
_EVENT_METADATA_FIELDS = {"request_id", "exam_id", "attempt_id", "job_id"}


def begin_context(**values: Any):
    """Install request/worker metadata for the current execution context."""
    return _context.set({key: value for key, value in values.items() if key in _ALLOWED_FIELDS and value is not None})


def update_context(**values: Any) -> None:
    current = dict(_context.get())
    current.update({key: value for key, value in values.items() if key in _ALLOWED_FIELDS and value is not None})
    _context.set(current)


def current_request_id() -> str | None:
    value = _context.get().get("request_id")
    return str(value) if value else None


def log_event(event: str, **values: Any) -> None:
    """Emit only allowlisted operational fields, never request payload data."""
    payload = {"event": event, **_context.get()}
    payload.update({key: value for key, value in values.items() if key in _ALLOWED_FIELDS and value is not None})
    _logger.info(json.dumps(payload, separators=(",", ":"), default=str))


def elapsed_ms(started_at: float) -> int:
    return round((perf_counter() - started_at) * 1000)


def tracing_metadata(metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    """Copy only trace identifiers into durable events; business payload remains untouched."""
    result = {key: value for key, value in (metadata or {}).items() if key in _EVENT_METADATA_FIELDS}
    if (request_id := current_request_id()):
        result.setdefault("request_id", request_id)
    return result
