from typing import Literal

from pydantic import BaseModel, Field, model_validator

from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest


class QuestionAddToDBRequest(BaseModel):
    question_text: str = Field(min_length=1, max_length=255)
    question_difficulties: Literal["easy", "medium", "hard"]
    question_type: Literal["MCQ", "essay", "true-false"]
    subject_id: str = Field(min_length=1, max_length=20)
    chapter_ids: list[int] = Field(default_factory=list)
    lo_ids: list[int] = Field(default_factory=list)
    question_status: Literal["draft", "pending", "approved", "rejected"] = "draft"
    options: list[QuestionOptionsRequest] = Field(default_factory=list)
    exam_id: int | None = None
    question_point: int | None = Field(default=None, gt=0)
    # Temporary input compatibility. Responses and the frontend use chapter_ids.
    chapter_id: int | None = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def normalize_legacy_chapter(self):
        if self.chapter_id is not None and not self.chapter_ids:
            self.chapter_ids = [self.chapter_id]
        if self.exam_id is not None and self.question_point is None:
            raise ValueError("question_point is required when exam_id is provided")
        return self
