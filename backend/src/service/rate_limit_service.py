"""Redis-backed, bounded rate limits for authentication-sensitive endpoints."""

from __future__ import annotations

import hashlib

from redis.exceptions import RedisError

from src.service.cache_service import get_cache_client


class RateLimitUnavailable(RuntimeError):
    """Raised when the shared limiter cannot enforce its security policy."""


# INCR and the first expiry must be one Redis operation. The subject is hashed
# before becoming part of the key, so emails and IP addresses are not retained
# in Redis key names or exposed through diagnostics.
_INCREMENT_WITH_TTL = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('TTL', KEYS[1])}
"""
_PREFIX = "oes:v1:rate-limit"


def _key(scope: str, subject: str) -> str:
    normalized_scope = scope.strip().lower()
    normalized_subject = subject.strip().lower()
    if not normalized_scope or not normalized_subject:
        raise ValueError("Rate-limit scope and subject must be non-empty")
    digest = hashlib.sha256(normalized_subject.encode("utf-8")).hexdigest()
    return f"{_PREFIX}:{normalized_scope}:{digest}"


def check(scope: str, subject: str, limit: int, window_seconds: int) -> bool:
    """Atomically consume one shared quota slot and return whether it is allowed.

    Authentication routes deliberately fail closed on Redis errors. Redis is
    still optional for all exam state because this service is never called by
    exam start, autosave, submit, or anti-cheat routes.
    """
    if limit < 1 or window_seconds < 1:
        raise ValueError("Rate-limit limit and window_seconds must be positive")
    try:
        count, _ttl = get_cache_client().eval(
            _INCREMENT_WITH_TTL,
            1,
            _key(scope, subject),
            int(window_seconds),
        )
    except (RedisError, OSError, ValueError, TypeError) as exc:
        raise RateLimitUnavailable("Authentication rate limiter is unavailable") from exc
    return int(count) <= limit
