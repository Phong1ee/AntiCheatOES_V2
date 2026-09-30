from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, StrictBool, field_validator

from src.a_db_config import ResultStrategy
from src.models.teacher.antiCheatPolicy import ANTI_CHEAT_MEASURES


NonNegativeInt = Annotated[int, Field(strict=True, ge=0)]
ViolationLimit = Annotated[int, Field(strict=True, ge=1, le=100)]


class AntiCheatMeasureRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: StrictBool
    threshold: ViolationLimit


class ExamSettingsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shuffle_question: bool = False
    shuffle_answer_options: bool = False
    sequential_navigation: bool = False
    auto_submit_on_expire: bool = True
    grace_period: NonNegativeInt = 0
    anti_cheat_enabled: StrictBool = False
    violation_limit: ViolationLimit = 5
    # Omit this field to preserve a pre-existing policy on older clients.
    anti_cheat_measures: dict[str, AntiCheatMeasureRequest] | None = None
    auto_grade: bool = True
    result_strategy: ResultStrategy = ResultStrategy.highest
    # Result visibility is saved with settings so the tab's single Save is atomic.
    result_visibility: Literal["hidden", "score-only", "full"] | None = None
    expected_version: int | None = Field(default=None, ge=1, validation_alias=AliasChoices("expected_version", "expectedVersion"))

    @field_validator("anti_cheat_measures")
    @classmethod
    def validate_measure_types(cls, value: dict[str, AntiCheatMeasureRequest] | None):
        if value is None:
            return value
        expected = set(ANTI_CHEAT_MEASURES)
        actual = set(value)
        if actual != expected:
            missing = sorted(expected - actual)
            unknown = sorted(actual - expected)
            details = []
            if missing:
                details.append(f"missing: {', '.join(missing)}")
            if unknown:
                details.append(f"unsupported: {', '.join(unknown)}")
            raise ValueError("anti_cheat_measures must configure every supported measure (" + "; ".join(details) + ")")
        return value

class ExamSettingsResponse(ExamSettingsRequest):
    exam_id: int
    version: int
