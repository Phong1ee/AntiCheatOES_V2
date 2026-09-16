"""Keep process-external cache state from leaking between isolated tests."""

import pytest

from src.service.cache_service import close_cache_client, delete_prefix


@pytest.fixture(autouse=True)
def reset_student_exam_cache():
    """Student exam list tests reuse IDs, so clear their Redis key family."""
    delete_prefix("oes:v1:student:exams")
    yield
    delete_prefix("oes:v1:student:exams")
    close_cache_client()
