from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class PoolRuleRequest(BaseModel):
    chapter_id: int = Field(gt=0)
    lo_id: int | None = Field(default=None, gt=0)
    difficulty: Literal["easy", "medium", "hard"]
    draw_count: int = Field(gt=0)
    max_score_per_question: Decimal = Field(default=Decimal("1.00"), gt=0, max_digits=10, decimal_places=2)


class PoolConfigRequest(BaseModel):
    subject_id: str = Field(min_length=1, max_length=20)
    fixed_randomization: bool = False
    rules: list[PoolRuleRequest] = Field(min_length=1)
    expected_version: int | None = Field(default=None, ge=1)


class PoolCandidateSelectionRequest(BaseModel):
    included_question_ids: list[int]
    expected_version: int | None = Field(default=None, ge=1)

    @field_validator("included_question_ids")
    @classmethod
    def unique_candidate_ids(cls, value: list[int]) -> list[int]:
        if any(item <= 0 for item in value):
            raise ValueError("included_question_ids must contain positive integers")
        if len(value) != len(set(value)):
            raise ValueError("included_question_ids must not contain duplicates")
        return value


class BulkQuestionIdsRequest(BaseModel):
    question_ids: list[int] = Field(min_length=1)
    expected_version: int | None = Field(default=None, ge=1)

    @field_validator("question_ids")
    @classmethod
    def unique_ids(cls, value: list[int]) -> list[int]:
        if any(item <= 0 for item in value):
            raise ValueError("question_ids must contain positive integers")
        if len(value) != len(set(value)):
            raise ValueError("question_ids must not contain duplicates")
        return value
