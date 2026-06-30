from pydantic import BaseModel, ConfigDict, Field


class QuestionAddToExamItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    questionId: int | None = None
    question_id: int | None = None
    text: str | None = None
    question_text: str | None = None
    type: str | None = None
    question_type: str | None = None
    points: int | None = None
    question_point: int | None = None
    options: list[dict] | None = None


class QuestionAddToExamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    examId: int = Field(alias="exam_id")
    questions: list[QuestionAddToExamItem]
