"""Idempotent manual-ack worker base for future workload-specific consumers."""

import json
from typing import Callable

import pika
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from src.a_db_config import ProcessedEvent
from src.service.rabbitmq_service import _connection, declare_topology
from src.service.observability_service import begin_context, log_event


def consume(
    queue: str,
    handler: Callable[[dict, object], None],
    *,
    prefetch: int = 10,
    retry_limit: int = 3,
    on_retry_exhausted: Callable[[dict, Exception, object], None] | None = None,
) -> None:
    """ACK only after handler returns; poison messages enter the queue DLQ."""
    connection = _connection()
    channel = connection.channel()
    declare_topology(channel)
    channel.basic_qos(prefetch_count=prefetch)

    def on_message(ch, method, properties, body):
        payload: dict = {}
        processing_error: Exception | None = None
        try:
            payload = json.loads(body)
            if not payload.get("event_id"):
                raise ValueError("event_id is required")
            worker_token = begin_context(
                event_id=payload["event_id"], event_type=payload.get("event_type"), queue=queue,
                request_id=(payload.get("metadata") or {}).get("request_id"),
                attempt_id=(payload.get("metadata") or {}).get("attempt_id"),
                exam_id=(payload.get("metadata") or {}).get("exam_id"),
                job_id=(payload.get("metadata") or {}).get("job_id"),
            )
            db = SessionLocal()
            try:
                # Import workers commit batches while processing. Their durable
                # job counters provide resume semantics, so record the message
                # marker only after all batches finish.
                batch_committing = queue == "import.queue" and payload.get("event_type") == "import.requested"
                if batch_committing:
                    already_processed = db.query(ProcessedEvent).filter_by(
                        consumer_name=queue, event_id=payload["event_id"]
                    ).first()
                    if not already_processed:
                        handler(payload, db)
                        db.add(ProcessedEvent(consumer_name=queue, event_id=payload["event_id"]))
                        db.commit()
                else:
                    marker = ProcessedEvent(consumer_name=queue, event_id=payload["event_id"])
                    db.add(marker)
                    try:
                        db.flush()
                    except IntegrityError:
                        # Only a duplicate processed-event marker is an idempotent
                        # redelivery. Handler IntegrityErrors must still retry.
                        db.rollback()
                    else:
                        handler(payload, db)
                        db.commit()
                    for callback in db.info.pop("after_commit", []):
                        try:
                            callback()
                        except Exception:
                            log_event("worker.after_commit_failed", status="failed")
                    log_event("worker.processed", status="completed")
            except Exception:
                db.rollback()
                db.info.pop("after_commit", None)
                raise
            finally:
                db.close()
                from src.service.observability_service import _context
                _context.reset(worker_token)
            ch.basic_ack(method.delivery_tag)
        except Exception as exc:
            processing_error = exc
            retries = int((properties.headers or {}).get("x-retry-count", 0))
            if retries >= retry_limit:
                if on_retry_exhausted is not None:
                    failure_db = SessionLocal()
                    try:
                        on_retry_exhausted(payload, processing_error, failure_db)
                        failure_db.commit()
                    except Exception:
                        failure_db.rollback()
                    finally:
                        failure_db.close()
                ch.basic_reject(method.delivery_tag, requeue=False)
            else:
                headers = dict(properties.headers or {})
                headers["x-retry-count"] = retries + 1
                ch.basic_publish(
                    exchange="oes.events",
                    routing_key=method.routing_key,
                    body=body,
                    properties=pika.BasicProperties(delivery_mode=2, headers=headers, message_id=properties.message_id),
                )
                ch.basic_ack(method.delivery_tag)

    channel.basic_consume(queue=queue, on_message_callback=on_message, auto_ack=False)
    try:
        channel.start_consuming()
    finally:
        connection.close()
