from decimal import Decimal

import pytest
from pydantic import ValidationError

from src.models.teacher.requestModel.ExamQuestionPoolRequest import PoolRuleRequest
from src.models.teacher.requestModel.QuestionsSelectFromBank import QuestionsSelectFromBank
from src.models.teacher.requestModel.TeacherExamRequest import TeacherExamRequest


def _exam_payload(**overrides):
    payload = {
        "title": "Normalized exam",
        "examcode": None,
        "max_attempt": 1,
        "description": "",
        "duration_minutes": 60,
        "start_time": "2030-01-01T09:00:00",
        "end_time": "2030-01-01T10:00:00",
        "status": "draft",
        "result_visibility": "hidden",
        "subject_id": "SUB-1",
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize("passing", [0, Decimal("5.50"), 100])
def test_passing_score_accepts_zero_through_hundred(passing):
    request = TeacherExamRequest(**_exam_payload(passing_score=passing))
    assert request.total_points == 100
    assert request.passing_score == Decimal(str(passing))


@pytest.mark.parametrize("passing", [Decimal("-0.01"), Decimal("100.01")])
def test_passing_score_rejects_values_outside_hundred_point_scale(passing):
    with pytest.raises(ValidationError):
        TeacherExamRequest(**_exam_payload(passing_score=passing))


def test_legacy_total_points_cannot_select_another_scale():
    with pytest.raises(ValidationError):
        TeacherExamRequest(**_exam_payload(total_points=10))


def test_import_defaults_max_score_and_accepts_legacy_name():
    assert QuestionsSelectFromBank(question_id=1).question_point is None
    assert QuestionsSelectFromBank(question_id=1, max_score="1.25").question_point == Decimal("1.25")
    assert QuestionsSelectFromBank(question_id=1, question_point="2").question_point == Decimal("2")


def test_pool_rule_defaults_to_one_and_rejects_non_positive_max_score():
    rule = PoolRuleRequest(chapter_id=1, difficulty="easy", draw_count=2)
    assert rule.max_score_per_question == Decimal("1.00")
    with pytest.raises(ValidationError):
        PoolRuleRequest(
            chapter_id=1,
            difficulty="easy",
            draw_count=2,
            max_score_per_question=0,
        )


@pytest.mark.parametrize(
    "start_time,end_time",
    [
        ("2030-01-01T10:00:00", "2030-01-01T10:00:00"),
        ("2030-01-01T10:00:00", "2030-01-01T09:59:59"),
        ("2030-01-01T09:00:00+07:00", "2030-01-01T10:00:00+07:00"),
    ],
    ids=["equal-times", "end-before-start", "offset-aware-times"],
)
def test_exam_request_rejects_invalid_or_offset_aware_schedule_values(start_time, end_time):
    with pytest.raises(ValidationError):
        TeacherExamRequest(**_exam_payload(start_time=start_time, end_time=end_time))
