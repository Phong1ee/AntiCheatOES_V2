import json
import logging
import unittest
import asyncio
from unittest.mock import patch

from src.middleware.observabilityMiddleware import ObservabilityMiddleware
from src.service import health_service
from src.service.audit_service import record_audit
from src.service.observability_service import begin_context, log_event
from src.service.outbox_publisher import enqueue_outbox_event


class ObservabilityTests(unittest.TestCase):
    def test_request_id_accepts_uuid_generates_for_invalid_value_and_returns_response_header(self):
        class Request:
            class Url:
                path = "/ok"

            url = Url()

            def __init__(self, value):
                self.headers = {"X-Request-ID": value}

        class Response:
            status_code = 200

            def __init__(self):
                self.headers = {}

        middleware = object.__new__(ObservabilityMiddleware)

        async def invoke(value):
            response = Response()

            async def next_handler(_request):
                return response

            return await middleware.dispatch(Request(value), next_handler)

        supplied = "123e4567-e89b-12d3-a456-426614174000"
        accepted = asyncio.run(invoke(supplied))
        generated = asyncio.run(invoke("not-a-uuid"))

        self.assertEqual(accepted.headers["X-Request-ID"], supplied)
        self.assertNotEqual(generated.headers["X-Request-ID"], "not-a-uuid")
        self.assertRegex(generated.headers["X-Request-ID"], r"^[0-9a-f-]{36}$")

    def test_readiness_keeps_api_ready_when_optional_dependencies_are_down(self):
        with patch.object(health_service, "mysql_ready", return_value=True), \
             patch.object(health_service, "redis_ready", return_value=False), \
             patch.object(health_service, "rabbitmq_ready", return_value=False):
            payload = health_service.readiness()
        self.assertEqual(payload["status"], "ready")
        self.assertEqual(payload["mysql"], "ready")
        self.assertEqual(payload["degraded"], ["redis", "rabbitmq"])

    def test_readiness_is_not_ready_when_mysql_is_down(self):
        with patch.object(health_service, "mysql_ready", return_value=False), \
             patch.object(health_service, "redis_ready", return_value=True), \
             patch.object(health_service, "rabbitmq_ready", return_value=True):
            self.assertEqual(health_service.readiness()["status"], "not_ready")

    def test_structured_logs_allow_only_operational_fields(self):
        with self.assertLogs("oes.observability", level="INFO") as logs:
            token = begin_context(request_id="request-1", route="/safe")
            try:
                log_event("test.event", password="secret", jwt="token", answer="sensitive", status=200)
            finally:
                from src.service.observability_service import _context
                _context.reset(token)
        payload = json.loads(logs.output[0].split(":", 2)[-1])
        self.assertEqual(payload, {"event": "test.event", "request_id": "request-1", "route": "/safe", "status": 200})

    def test_audit_uses_active_request_context_without_accepting_sensitive_log_data(self):
        class Session:
            def __init__(self):
                self.added = []

            def add(self, item):
                self.added.append(item)

        db = Session()
        token = begin_context(request_id="request-audit")
        try:
            audit = record_audit(
                db,
                actor_school_id="T1",
                actor_role="teacher",
                action="TEST",
                entity_type="exam",
                entity_id=1,
                metadata={"password": "secret", "safe": True},
            )
        finally:
            from src.service.observability_service import _context
            _context.reset(token)
        self.assertEqual(audit.request_id, "request-audit")
        self.assertEqual(audit.metadata_json, {"safe": True})

    def test_outbox_propagates_request_id_without_payload_secrets(self):
        class Session:
            def __init__(self):
                self.added = []

            def add(self, item):
                self.added.append(item)

        db = Session()
        token = begin_context(request_id="request-outbox")
        try:
            event = enqueue_outbox_event(
                db,
                event_type="report.requested",
                aggregate_type="background_job",
                aggregate_id=7,
                metadata={"job_id": 7, "password": "secret"},
            )
        finally:
            from src.service.observability_service import _context
            _context.reset(token)
        self.assertEqual(event.payload_json, {"job_id": 7, "request_id": "request-outbox"})


if __name__ == "__main__":
    unittest.main()
