from pydantic import BaseModel, ConfigDict, Field


class VerifyCodeRequest(BaseModel):
    code: str


class SubmitAnswerRequest(BaseModel):
    questionId: int
    selectedOptionId: int | None = None
    answerText: str | None = None


class SubmitExamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    attemptId: int = Field(alias="attempt_id")
    answers: list[SubmitAnswerRequest]
    timeSpentSeconds: int | None = None
