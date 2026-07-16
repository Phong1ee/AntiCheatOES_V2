from typing import Literal

from pydantic import BaseModel, Field, model_validator

from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest


class QuestionUpdateRequest(BaseModel):
    question_point: int = Field(gt=0)
    question_text: str | None = Field(default=None, min_length=1, max_length=255)
    question_difficulties: Literal["easy", "medium", "hard"] | None = None
    question_type: Literal["MCQ", "essay", "true-false"] | None = None
    subject_id: str | None = Field(default=None, min_length=1, max_length=20)
    chapter_ids: list[int] | None = None
    lo_ids: list[int] | None = None
    question_status: Literal["draft", "pending", "approved", "rejected"] | None = None
    options: list[QuestionOptionsRequest] = Field(default_factory=list)
    chapter_id: int | None = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def normalize_legacy_chapter(self):
        if self.chapter_id is not None and self.chapter_ids is None:
            self.chapter_ids = [self.chapter_id]
        return self
