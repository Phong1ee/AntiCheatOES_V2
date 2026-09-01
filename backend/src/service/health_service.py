"""Dependency probes and admin-safe health summaries."""

from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from database import engine
from src.a_db_config import Attempt, AttemptStatus, BackgroundJob, BackgroundJobStatus, Exam, ExamStatus, User
from src.service.cache_service import get_cache_client
from src.service.cache_service import current_http_metric, worker_is_alive
from src.service.railway_health_service import railway_health
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


_WORKERS = ("report", "import", "grading", "notification", "analytics", "anti_cheat")


def system_health(db: Session) -> dict:
    """Return operational facts only; infrastructure capacity stays in Railway."""
    dependency = readiness()
    now = datetime.now()
    active_exams = db.query(Exam).filter(
        Exam.status == ExamStatus.published,
        Exam.start_time.isnot(None), Exam.end_time.isnot(None),
        Exam.start_time <= now, Exam.end_time >= now,
    ).count()
    active_attempts = db.query(Attempt).filter(
        Attempt.status == AttemptStatus.in_progress,
        Attempt.last_heartbeat_at.isnot(None),
        Attempt.last_heartbeat_at >= now - timedelta(minutes=5),
    ).count()
    metrics = current_http_metric()
    railway = railway_health()
    worker_states = []
    for name in _WORKERS:
        alive = worker_is_alive(name)
        worker_states.append({"name": f"worker-{name.replace('_', '-')}", "status": "healthy" if alive else ("offline" if alive is False else "unavailable")})

    services = [
        {"name": "API", "status": "healthy"},
        {"name": "MySQL", "status": "healthy" if dependency["mysql"] == "ready" else "unavailable"},
        {"name": "Redis", "status": "healthy" if dependency["redis"] == "ready" else "degraded"},
        {"name": "RabbitMQ", "status": "healthy" if dependency["rabbitmq"] == "ready" else "degraded"},
        *worker_states,
    ]
    alerts = [
        {"severity": "warning" if item["status"] == "degraded" else "error", "message": f"{item['name']} is {item['status']}"}
        for item in services if item["status"] in {"degraded", "unavailable", "offline"}
    ]
    failed_jobs = db.query(BackgroundJob).filter(
        BackgroundJob.status == BackgroundJobStatus.failed,
        BackgroundJob.created_at >= now - timedelta(hours=24),
    ).order_by(BackgroundJob.created_at.desc()).limit(5).all()
    alerts.extend({"severity": "error", "message": f"Background job {job.job_id} failed"} for job in failed_jobs)
    overall = "unavailable" if dependency["mysql"] != "ready" else ("degraded" if alerts else "healthy")
    return {
        "status": overall,
        "checked_at": now.isoformat(),
        "statistics": {
            "total_users": db.query(User).count(),
            "active_exams": active_exams,
            "students_in_progress": active_attempts,
            "api_requests_per_minute": metrics["requests_per_minute"] if metrics else None,
            "api_average_latency_ms": metrics["average_latency_ms"] if metrics else None,
        },
        "services": services,
        "alerts": alerts,
        "railway": railway,
    }
