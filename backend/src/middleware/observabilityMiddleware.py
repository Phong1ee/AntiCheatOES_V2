"""Request ID and sanitized access logging for every API response."""

from time import perf_counter
from uuid import UUID, uuid4

from starlette.middleware.base import BaseHTTPMiddleware

from src.service.audit_service import begin_audit_request_context, reset_audit_request_context
from src.service.observability_service import begin_context, elapsed_ms, log_event
from src.service.cache_service import record_http_metric


def _request_id(value: str | None) -> str:
    if value:
        try:
            return str(UUID(value.strip()))
        except (ValueError, AttributeError):
            pass
    return str(uuid4())


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = _request_id(request.headers.get("X-Request-ID"))
        token = begin_context(request_id=request_id, route=request.url.path)
        client = getattr(request, "client", None)
        audit_token = begin_audit_request_context(
            client_ip=getattr(client, "host", None),
            user_agent=request.headers.get("user-agent"),
        )
        started_at = perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            latency_ms = elapsed_ms(started_at)
            log_event("http.request", status=status_code, latency_ms=latency_ms)
            record_http_metric(latency_ms)
            from src.service.observability_service import _context
            _context.reset(token)
            reset_audit_request_context(audit_token)
