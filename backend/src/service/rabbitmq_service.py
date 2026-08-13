"""The single shared RabbitMQ topology and publishing adapter."""

import json
import os
from typing import Any

import pika


EXCHANGE = "oes.events"
QUEUES = ("grading.queue", "notification.queue", "report.queue", "analytics.queue", "anti_cheat.queue", "import.queue")


def rabbitmq_url() -> str:
    return os.getenv("RABBITMQ_URL", "amqp://guest:guest@127.0.0.1:5672/").strip()


def _connection() -> pika.BlockingConnection:
    parameters = pika.URLParameters(rabbitmq_url())
    parameters.connection_attempts = 1
    parameters.retry_delay = 0
    parameters.socket_timeout = float(os.getenv("RABBITMQ_SOCKET_TIMEOUT", "1"))
    parameters.blocked_connection_timeout = float(os.getenv("RABBITMQ_BLOCKED_TIMEOUT", "2"))
    return pika.BlockingConnection(parameters)


def routing_key_for(event_type: str) -> str:
    if event_type.startswith("attempt."):
        return "grading.attempt"
    if event_type.startswith("grading."):
        return "grading.result"
    if event_type.startswith("exam.violation."):
        return "anti_cheat.violation"
    if event_type.startswith("report."):
        return "report.requested"
    if event_type.startswith("import."):
        return "import.requested"
    if event_type.startswith("notification."):
        return "notification.requested"
    return "analytics.event"


def declare_topology(channel: pika.adapters.blocking_connection.BlockingChannel) -> None:
    """Declare durable topic queues and per-queue DLQs idempotently."""
    channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
    channel.exchange_declare(exchange=f"{EXCHANGE}.dlx", exchange_type="topic", durable=True)
    for queue in QUEUES:
        dlq = f"{queue}.dlq"
        channel.queue_declare(queue=dlq, durable=True)
        channel.queue_bind(queue=dlq, exchange=f"{EXCHANGE}.dlx", routing_key="#")
        channel.queue_declare(
            queue=queue,
            durable=True,
            arguments={"x-dead-letter-exchange": f"{EXCHANGE}.dlx"},
        )
        channel.queue_bind(queue=queue, exchange=EXCHANGE, routing_key=f"{queue.removesuffix('.queue')}.*")


def publish_envelope(envelope: dict[str, Any]) -> None:
    """Publish a persistent envelope and return only after broker confirmation."""
    connection = _connection()
    try:
        channel = connection.channel()
        declare_topology(channel)
        channel.confirm_delivery()
        channel.basic_publish(
            exchange=EXCHANGE,
            routing_key=routing_key_for(envelope["event_type"]),
            body=json.dumps(envelope, separators=(",", ":"), default=str),
            properties=pika.BasicProperties(
                delivery_mode=pika.DeliveryMode.Persistent,
                content_type="application/json",
                message_id=envelope["event_id"],
                type=envelope["event_type"],
            ),
            mandatory=True,
        )
    finally:
        connection.close()
