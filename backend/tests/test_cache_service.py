import unittest
from unittest.mock import patch

from redis.exceptions import ConnectionError as RedisConnectionError

from src.service import cache_service
from src.service.cache_invalidation_contract import deliver_invalidation, teacher_assignment_changed


class _MemoryRedis:
    def __init__(self):
        self.values = {}

    def get(self, key):
        return self.values.get(key)

    def set(self, key, value, ex):
        self.values[key] = value

    def delete(self, *keys):
        for key in keys:
            self.values.pop(key, None)

    def scan_iter(self, match, count):
        prefix = match[:-1]
        return iter([key for key in self.values if key.startswith(prefix)])

    def close(self):
        return None


class CacheServiceTests(unittest.TestCase):
    def tearDown(self):
        cache_service.close_cache_client()

    def test_cache_aside_uses_bounded_json_value_and_ttl(self):
        memory = _MemoryRedis()
        with patch("src.service.cache_service.get_cache_client", return_value=memory):
            calls = 0

            def load():
                nonlocal calls
                calls += 1
                return {"items": ["mysql"]}

            key = cache_service.student_exam_list_key("S1")
            self.assertEqual(cache_service.cache_aside(key, 30, load), {"items": ["mysql"]})
            self.assertEqual(cache_service.cache_aside(key, 30, load), {"items": ["mysql"]})
            self.assertEqual(calls, 1)

    def test_redis_failure_falls_back_to_loader_and_invalidations_are_safe(self):
        with patch("src.service.cache_service.get_cache_client", side_effect=RedisConnectionError("down")):
            self.assertEqual(cache_service.cache_aside("oes:v1:test", 30, lambda: {"source": "mysql"}), {"source": "mysql"})
            deliver_invalidation(teacher_assignment_changed(1))

    def test_question_filter_keys_are_hashed_and_user_scoped(self):
        one = cache_service.teacher_question_bank_key("T1", "approved", {"search": "normal"})
        two = cache_service.teacher_question_bank_key("T2", "approved", {"search": "normal"})
        self.assertNotIn("normal", one)
        self.assertNotEqual(one, two)

    def test_admin_permission_list_key_is_hashed_and_invalidation_clears_it(self):
        memory = _MemoryRedis()
        filters = {"search": "teacher@example.test", "is_active": True}
        key = cache_service.admin_teacher_permissions_key(filters)
        self.assertNotIn("teacher@example.test", key)
        with patch("src.service.cache_service.get_cache_client", return_value=memory):
            self.assertEqual(cache_service.cache_aside(key, 60, lambda: {"items": ["mysql"]}), {"items": ["mysql"]})
            cache_service.invalidate_admin_teacher_permissions()
        self.assertNotIn(key, memory.values)


if __name__ == "__main__":
    unittest.main()
