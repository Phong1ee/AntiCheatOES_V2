from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator

from src.a_db_config import ResultStrategy


NonNegativeInt = Annotated[int, Field(strict=True, ge=0)]
ViolationLimit = Annotated[int, Field(strict=True, ge=1, le=100)]


class ExamSettingsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shuffle_question: bool = False
    shuffle_answer_options: bool = False
    sequential_navigation: bool = False
    auto_submit_on_expire: bool = True
    grace_period: NonNegativeInt = 0
    force_fullscreen_thresh: NonNegativeInt = 0
    tab_switch_thresh: NonNegativeInt = 0
    copy_paste_thresh: NonNegativeInt = 0
    # Optional fields distinguish legacy payloads from the new anti-cheat contract.
    anti_cheat_enabled: Optional[StrictBool] = None
    violation_limit: Optional[ViolationLimit] = None
    auto_grade: bool = True
    result_strategy: ResultStrategy = ResultStrategy.highest

    @model_validator(mode="after")
    def require_limit_when_enabling_anti_cheat(self):
        if self.anti_cheat_enabled is True and self.violation_limit is None:
            raise ValueError("violation_limit is required when anti_cheat_enabled is true")
        return self


class ExamSettingsResponse(ExamSettingsRequest):
    exam_id: int
    anti_cheat_enabled: StrictBool
    violation_limit: ViolationLimit
