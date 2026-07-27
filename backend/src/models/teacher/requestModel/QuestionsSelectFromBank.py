from decimal import Decimal

from pydantic import BaseModel, Field

class QuestionsSelectFromBank(BaseModel):
    question_id: int = Field(strict=True, gt=0)
    question_point: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
