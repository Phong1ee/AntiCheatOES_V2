import pytest
from pydantic import ValidationError

from src.a_db_config import ExamSetting
from src.models.teacher.requestModel.ExamSettingsRequest import ExamSettingsRequest
from src.route.teacherRoute.examSettingsRoute import _apply


def test_settings_request_accepts_questions_per_page_sent_by_the_frontend():
    payload = ExamSettingsRequest(questions_per_page=5, shuffle_question=True)
    assert payload.questions_per_page == 5


@pytest.mark.parametrize("value", [0, 51, "3", 1.5])
def test_questions_per_page_is_range_and_type_checked(value):
    with pytest.raises(ValidationError):
        ExamSettingsRequest(questions_per_page=value)


def test_apply_ignores_fields_without_a_column_and_keeps_the_rest():
    setting = ExamSetting(exam_id=1)
    _apply(setting, ExamSettingsRequest(questions_per_page=5, shuffle_question=True, grace_period=3))
    assert setting.shuffle_question is True
    assert setting.grace_period == 3
    assert not hasattr(type(setting), "questions_per_page")
    assert "questions_per_page" not in setting.__dict__
