from decimal import Decimal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest

class QuestionAddToExamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    exam_id: int = Field(..., description="The ID of the exam to which the question will be added.")
    question_id: int = Field(..., description="The ID of the question to be added to the exam.")
    question_point: Decimal = Field(
        default=Decimal("1.00"),
        validation_alias=AliasChoices("max_score", "question_point"),
        serialization_alias="max_score",
        gt=0,
        max_digits=10,
        decimal_places=2,
        description="The raw maximum score assigned to the question in this exam.",
    )
    options: list[QuestionOptionsRequest] = Field(default_factory=list)
