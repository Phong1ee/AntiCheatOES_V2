"""A small fixed-memory sliding-window rate limiter.

This exists for the one case the database cannot cover: a request for an address
that is not registered writes no row, so there is nothing to count. Without this
an attacker could hammer the forgot-password endpoint with invented addresses.
Registered addresses are throttled in password_reset_service against real rows,
which survives a restart; this layer is the outer, coarser guard.

Deliberately in-process. It is per worker, so N workers allow N times the quota,
and it resets when the process does - real deployments push this into Redis or
the reverse proxy. For this application's scale that trade is worth not adding a
dependency and a failure mode to the login path.
"""

from __future__ import annotations

import threading
import time
from collections import deque


# Bounded so a flood of distinct keys cannot grow this without limit; the
# eviction below drops the least recently touched key when it is reached.
MAX_TRACKED_KEYS = 10_000

_lock = threading.Lock()
_hits: dict[str, deque[float]] = {}


def _prune(timestamps: deque[float], window_seconds: float, now: float) -> None:
    cutoff = now - window_seconds
    while timestamps and timestamps[0] <= cutoff:
        timestamps.popleft()


def check(key: str, limit: int, window_seconds: float) -> bool:
    """Record a hit for `key`; return False when it is over the limit.

    The hit is recorded only when it is allowed, so a caller being refused does
    not extend its own penalty indefinitely.
    """
    now = time.monotonic()
    with _lock:
        timestamps = _hits.get(key)
        if timestamps is None:
            if len(_hits) >= MAX_TRACKED_KEYS:
                _hits.pop(next(iter(_hits)), None)
            timestamps = _hits[key] = deque()
        _prune(timestamps, window_seconds, now)
        if len(timestamps) >= limit:
            return False
        timestamps.append(now)
        return True


def reset() -> None:
    """Drop all counters. For tests."""
    with _lock:
        _hits.clear()
