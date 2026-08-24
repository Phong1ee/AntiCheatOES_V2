import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError as RedisConnectionError
from starlette.requests import Request

from src.route.authRoute import LoginRequest, login
from src.service import rate_limit_service


class FakeRedis:
    """Small shared Redis protocol model; two callers receive one store."""

    def __init__(self):
        self.now = 0
        self.values = {}
        self.expires = {}

    def eval(self, _script, _keys, key, window):
        if key in self.expires and self.expires[key] <= self.now:
            self.values.pop(key, None)
            self.expires.pop(key, None)
        self.values[key] = self.values.get(key, 0) + 1
        if self.values[key] == 1:
            self.expires[key] = self.now + int(window)
        return [self.values[key], self.expires[key] - self.now]

    def advance(self, seconds):
        self.now += seconds


class UnavailableRedis:
    def eval(self, *_args):
        raise RedisConnectionError("redis down")


def _request(ip="198.51.100.11"):
    return Request({"type": "http", "client": (ip, 12345), "headers": []})


def test_limit_is_shared_between_simulated_api_instances_and_expires(monkeypatch):
    shared_redis = FakeRedis()
    monkeypatch.setattr(rate_limit_service, "get_cache_client", lambda: shared_redis)

    assert rate_limit_service.check("login:ip", "198.51.100.11", 2, 30)
    assert rate_limit_service.check("login:ip", "198.51.100.11", 2, 30)
    assert not rate_limit_service.check("login:ip", "198.51.100.11", 2, 30)

    shared_redis.advance(30)
    assert rate_limit_service.check("login:ip", "198.51.100.11", 2, 30)


def test_redis_failure_is_explicit_for_sensitive_authentication(monkeypatch):
    monkeypatch.setattr(rate_limit_service, "get_cache_client", lambda: UnavailableRedis())

    with pytest.raises(rate_limit_service.RateLimitUnavailable):
        rate_limit_service.check("login:ip", "198.51.100.11", 2, 30)


def test_login_returns_429_when_shared_limit_is_exceeded(monkeypatch):
    shared_redis = FakeRedis()
    monkeypatch.setattr("src.route.authRoute.check_rate_limit", rate_limit_service.check)
    monkeypatch.setattr(rate_limit_service, "get_cache_client", lambda: shared_redis)
    monkeypatch.setenv("AUTH_LOGIN_IP_LIMIT", "1")
    monkeypatch.setenv("AUTH_LOGIN_EMAIL_LIMIT", "10")

    with pytest.raises(HTTPException) as first:
        login(LoginRequest(email="student@example.test", password="wrong"), _request())
    assert first.value.status_code == 401

    with pytest.raises(HTTPException) as second:
        login(LoginRequest(email="student@example.test", password="wrong"), _request())
    assert second.value.status_code == 429


def test_login_fails_closed_when_redis_is_unavailable(monkeypatch):
    monkeypatch.setattr("src.route.authRoute.check_rate_limit", rate_limit_service.check)
    monkeypatch.setattr(rate_limit_service, "get_cache_client", lambda: UnavailableRedis())

    with pytest.raises(HTTPException) as exc_info:
        login(LoginRequest(email="student@example.test", password="wrong"), _request())
    assert exc_info.value.status_code == 503
