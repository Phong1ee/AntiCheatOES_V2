from decimal import Decimal

from pydantic import AliasChoices, BaseModel, Field

class QuestionsSelectFromBank(BaseModel):
    question_id: int = Field(strict=True, gt=0)
    question_point: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=10,
        decimal_places=2,
        validation_alias=AliasChoices("max_score", "question_point"),
    )
    expected_version: int | None = Field(default=None, ge=1)
