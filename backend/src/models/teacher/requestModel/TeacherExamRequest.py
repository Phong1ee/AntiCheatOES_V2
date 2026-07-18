from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

class TeacherExamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., description="The title of the exam.")
    examcode: str = Field(..., description="The unique code for the exam.")
    max_attempt: int = Field(
        ...,
        ge=0,
        validation_alias=AliasChoices("max_attempt", "max_attemmpt"),
        description="The maximum number of attempts allowed for the exam.",
    )
    description: str = Field(..., description="A brief description of the exam.")
    duration_minutes: int = Field(..., gt=0, description="The duration of the exam in minutes.")
    result_visibility: Literal["hidden", "score-only", "full"] = Field(...)
    subject_id: str = Field(..., description="The ID of the subject associated with the exam.")
