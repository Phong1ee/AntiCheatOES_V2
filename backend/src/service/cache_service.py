"""One fail-open Redis cache-aside service for all API roles."""

import json
import os
from hashlib import sha256
from typing import Any, Callable, TypeVar

import redis
from redis.exceptions import RedisError


_T = TypeVar("_T")
_PREFIX = "oes:v1"
_client: redis.Redis | None = None


def _redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0").strip()


def get_cache_client() -> redis.Redis:
    """Create the sole Redis pool lazily so a down cache never prevents startup."""
    global _client
    if _client is None:
        pool = redis.ConnectionPool.from_url(
            _redis_url(),
            decode_responses=True,
            max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "10")),
            socket_connect_timeout=float(os.getenv("REDIS_CONNECT_TIMEOUT", "0.2")),
            socket_timeout=float(os.getenv("REDIS_SOCKET_TIMEOUT", "0.2")),
            health_check_interval=30,
        )
        _client = redis.Redis(connection_pool=pool)
    return _client


def close_cache_client() -> None:
    global _client
    if _client is not None:
        try:
            _client.close()
        except RedisError:
            pass
        finally:
            _client = None


def cache_key(*parts: object) -> str:
    normalized = [str(part).strip().replace(" ", "_") for part in parts]
    if any(not part for part in normalized):
        raise ValueError("Cache key parts must be non-empty")
    return ":".join([_PREFIX, *normalized])


def stable_key_fragment(value: object) -> str:
    """Keep compound filter keys short without exposing arbitrary query text."""
    serialized = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return sha256(serialized.encode("utf-8")).hexdigest()[:20]


def get_json(key: str) -> Any | None:
    try:
        payload = get_cache_client().get(key)
        return json.loads(payload) if payload else None
    except (RedisError, TypeError, ValueError):
        return None


def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        get_cache_client().set(key, json.dumps(value, separators=(",", ":"), default=str), ex=ttl_seconds)
    except (RedisError, TypeError, ValueError):
        # Redis is an optimization: callers always retain their MySQL result.
        return


def cache_aside(key: str, ttl_seconds: int, loader: Callable[[], _T]) -> _T:
    cached = get_json(key)
    if cached is not None:
        return cached
    value = loader()
    set_json(key, value, ttl_seconds)
    return value


def delete_key(key: str) -> None:
    try:
        get_cache_client().delete(key)
    except RedisError:
        return


def delete_prefix(prefix: str) -> None:
    """Remove a small related key family after a successful DB commit."""
    try:
        client = get_cache_client()
        keys = list(client.scan_iter(match=f"{prefix}*", count=100))
        if keys:
            client.delete(*keys)
    except RedisError:
        return


def student_exam_list_key(school_id: str) -> str:
    return cache_key("student", "exams", school_id)


def teacher_subjects_key(school_id: str) -> str:
    return cache_key("teacher", "subjects", school_id)


def teacher_question_bank_key(school_id: str, scope: str, filters: dict[str, object]) -> str:
    return cache_key("teacher", "question-bank", school_id, scope, stable_key_fragment(filters))


def admin_teacher_permissions_key(filters: dict[str, object]) -> str:
    """Cache a non-security-decision Admin list using an opaque filter hash."""
    return cache_key("admin", "teacher-permissions", stable_key_fragment(filters))


def invalidate_admin_teacher_permissions() -> None:
    delete_prefix(cache_key("admin", "teacher-permissions"))


def invalidate_student_exam_lists(student_ids: set[str] | list[str]) -> None:
    for school_id in student_ids:
        delete_key(student_exam_list_key(school_id))


def invalidate_teacher_question_bank(teacher_school_id: str | None = None) -> None:
    prefix = cache_key("teacher", "question-bank")
    if teacher_school_id:
        prefix = f"{prefix}:{teacher_school_id}"
    delete_prefix(prefix)
