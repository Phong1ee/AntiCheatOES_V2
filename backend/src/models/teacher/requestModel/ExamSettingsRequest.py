from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


NonNegativeInt = Annotated[int, Field(strict=True, ge=0)]


class ExamSettingsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shuffle_question: bool = False
    shuffle_answer_options: bool = False
    auto_submit_on_expire: bool = True
    grace_period: NonNegativeInt = 0
    force_fullscreen_thresh: NonNegativeInt = 0
    tab_switch_thresh: NonNegativeInt = 0
    copy_paste_thresh: NonNegativeInt = 0
    auto_grade: bool = True


class ExamSettingsResponse(ExamSettingsRequest):
    exam_id: int
