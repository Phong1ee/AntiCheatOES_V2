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


def test_apply_persists_page_size_and_other_settings():
    setting = ExamSetting(exam_id=1)
    _apply(setting, ExamSettingsRequest(questions_per_page=5, shuffle_question=True, grace_period=3))
    assert setting.shuffle_question is True
    assert setting.grace_period == 3
    assert setting.questions_per_page == 5


def test_omitted_page_size_preserves_existing_value():
    setting = ExamSetting(exam_id=1, questions_per_page=7)
    _apply(setting, ExamSettingsRequest(shuffle_question=True))
    assert setting.questions_per_page == 7
