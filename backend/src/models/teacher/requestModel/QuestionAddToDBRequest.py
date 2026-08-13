from decimal import Decimal
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest


class QuestionAddToDBRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    question_text: str = Field(min_length=1, max_length=255)
    question_difficulties: Literal["easy", "medium", "hard"]
    question_type: Literal["MCQ", "essay", "true-false"]
    subject_id: str = Field(min_length=1, max_length=20)
    chapter_ids: list[int] = Field(default_factory=list)
    lo_ids: list[int] = Field(default_factory=list)
    question_status: Literal["draft", "pending", "approved", "rejected"] = "draft"
    options: list[QuestionOptionsRequest] = Field(default_factory=list)
    exam_id: int | None = None
    expected_version: int | None = Field(default=None, ge=1)
    question_point: Decimal | None = Field(
        default=None,
        validation_alias=AliasChoices("max_score", "question_point"),
        serialization_alias="max_score",
        gt=0,
        max_digits=10,
        decimal_places=2,
    )
    # Temporary input compatibility. Responses and the frontend use chapter_ids.
    chapter_id: int | None = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def normalize_legacy_chapter(self):
        if self.chapter_id is not None and not self.chapter_ids:
            self.chapter_ids = [self.chapter_id]
        if self.exam_id is not None and self.question_point is None:
            self.question_point = Decimal("1.00")
        return self
