from pydantic import BaseModel, Field

class QuestionsSelectFromBank(BaseModel):
    question_id: int = Field(strict=True, gt=0)
    question_point: int = Field(strict=True, gt=0)
