from decimal import Decimal
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest


class QuestionUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question_point: Decimal = Field(
        validation_alias=AliasChoices("max_score", "question_point"),
        serialization_alias="max_score",
        gt=0,
        max_digits=10,
        decimal_places=2,
    )
    question_text: str | None = Field(default=None, min_length=1, max_length=255)
    question_difficulties: Literal["easy", "medium", "hard"] | None = None
    question_type: Literal["MCQ", "essay", "true-false"] | None = None
    subject_id: str | None = Field(default=None, min_length=1, max_length=20)
    chapter_ids: list[int] | None = None
    lo_ids: list[int] | None = None
    question_status: Literal["draft", "pending", "approved", "rejected"] | None = None
    options: list[QuestionOptionsRequest] | None = None
    chapter_id: int | None = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def normalize_legacy_chapter(self):
        if self.chapter_id is not None and self.chapter_ids is None:
            self.chapter_ids = [self.chapter_id]
        return self
