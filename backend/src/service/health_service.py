"""Dependency probes used by readiness without making cache/broker critical."""

from sqlalchemy import text

from database import engine
from src.service.cache_service import get_cache_client
from src.service.rabbitmq_service import _connection


def mysql_ready() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def redis_ready() -> bool:
    try:
        return bool(get_cache_client().ping())
    except Exception:
        return False


def rabbitmq_ready() -> bool:
    try:
        connection = _connection()
        connection.close()
        return True
    except Exception:
        return False


def readiness() -> dict:
    mysql = mysql_ready()
    redis = redis_ready()
    rabbitmq = rabbitmq_ready()
    degraded = [name for name, ready in (("redis", redis), ("rabbitmq", rabbitmq)) if not ready]
    return {
        "status": "ready" if mysql else "not_ready",
        "mysql": "ready" if mysql else "unavailable",
        "redis": "ready" if redis else "degraded",
        "rabbitmq": "ready" if rabbitmq else "degraded",
        "degraded": degraded,
    }
