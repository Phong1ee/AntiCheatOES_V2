import unittest
from datetime import datetime
from unittest.mock import patch

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import OutboxEvent, ProcessedEvent
from src.service.outbox_publisher import publish_pending
from src.service.rabbitmq_service import routing_key_for


class OutboxPublisherTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(cls.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()

    def _event(self, event_id="00000000-0000-0000-0000-000000000001"):
        event = OutboxEvent(
            event_id=event_id,
            event_type="attempt.submitted",
            aggregate_type="attempt",
            aggregate_id="1",
            payload_json={"attemptId": 1, "studentId": "S1", "password": "never-publish"},
            created_at=datetime.now(),
        )
        self.db.add(event)
        self.db.commit()
        return event

    def test_confirmed_publish_marks_row_after_publish(self):
        event = self._event()
        published = []
        with patch("src.service.outbox_publisher.publish_envelope", side_effect=published.append):
            self.assertEqual(publish_pending(self.db), 1)

        refreshed = self.db.get(OutboxEvent, event.outbox_event_id)
        self.assertIsNotNone(refreshed.published_at)
        self.assertEqual(refreshed.retry_count, 0)
        self.assertEqual(published[0]["event_id"], event.event_id)
        self.assertNotIn("password", published[0]["metadata"])

    def test_broker_failure_keeps_event_pending_for_retry(self):
        event = self._event()
        with patch("src.service.outbox_publisher.publish_envelope", side_effect=RuntimeError("broker down")):
            self.assertEqual(publish_pending(self.db), 0)

        refreshed = self.db.get(OutboxEvent, event.outbox_event_id)
        self.assertIsNone(refreshed.published_at)
        self.assertEqual(refreshed.retry_count, 1)
        self.assertEqual(refreshed.last_error, "broker down")

    def test_routing_is_shared_and_bounded_to_declared_workloads(self):
        self.assertEqual(routing_key_for("attempt.submitted"), "grading.attempt")
        self.assertEqual(routing_key_for("exam.violation.recorded"), "anti_cheat.violation")
        self.assertEqual(routing_key_for("report.requested"), "report.requested")
        self.assertEqual(routing_key_for("import.requested"), "import.requested")
        self.assertEqual(routing_key_for("unrecognized.event"), "analytics.event")

    def test_processed_event_marker_deduplicates_worker_redelivery(self):
        self.db.add(ProcessedEvent(consumer_name="grading.queue", event_id="00000000-0000-0000-0000-000000000009"))
        self.db.commit()
        duplicate = ProcessedEvent(consumer_name="grading.queue", event_id="00000000-0000-0000-0000-000000000009")
        self.db.add(duplicate)
        with self.assertRaises(Exception):
            self.db.flush()
        self.db.rollback()
        self.assertEqual(self.db.query(ProcessedEvent).count(), 1)


if __name__ == "__main__":
    unittest.main()
