from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, StrictBool

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
    anti_cheat_enabled: StrictBool = False
    violation_limit: ViolationLimit = 5
    auto_grade: bool = True
    result_strategy: ResultStrategy = ResultStrategy.highest
    # Result visibility is saved with settings so the tab's single Save is atomic.
    result_visibility: Literal["hidden", "score-only", "full"] | None = None
    expected_version: int | None = Field(default=None, ge=1, validation_alias=AliasChoices("expected_version", "expectedVersion"))

class ExamSettingsResponse(ExamSettingsRequest):
    exam_id: int
    version: int
