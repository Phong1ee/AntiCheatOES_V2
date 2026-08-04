from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator


ExamStatusValue = Literal["draft", "published"]


class TeacherExamStatusRequest(BaseModel):
    status: ExamStatusValue


class TeacherResultVisibilityRequest(BaseModel):
    result_visibility: Literal["hidden", "score-only", "full"]


class TeacherExamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., description="The title of the exam.")
    examcode: str | None = Field(default=None, max_length=20, description="The optional unique code for the exam.")
    max_attempt: int = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("max_attempt", "max_attemmpt"),
        description="The maximum number of attempts allowed for the exam.",
    )
    description: str = Field(..., description="A brief description of the exam.")
    duration_minutes: int = Field(..., gt=0, description="The duration of the exam in minutes.")
    start_time: datetime = Field(..., description="Local exam availability start date and time.")
    end_time: datetime = Field(..., description="Local exam availability end date and time.")
    status: ExamStatusValue = Field(default="draft")
    result_visibility: Literal["hidden", "score-only", "full"] = Field(...)
    subject_id: str = Field(..., description="The ID of the subject associated with the exam.")

    total_points: Literal[10] = Field(default=10, description="Deprecated fixed grading scale.")
    passing_score: Decimal = Field(default=Decimal("5.00"), ge=0, le=10, max_digits=4, decimal_places=2)

    @model_validator(mode="after")
    def validate_score_range(self):
        if self.start_time.tzinfo is not None or self.end_time.tzinfo is not None:
            raise ValueError("start_time and end_time must use local date-time values without a timezone")
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be strictly later than start_time")
        return self
