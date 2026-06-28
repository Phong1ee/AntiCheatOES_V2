from pydantic import BaseModel, ConfigDict, Field

class QuestionAddToExamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    examId: int = Field(alias="exam_id")
    questions: list[dict]  # List of question objects