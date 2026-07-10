from pydantic import BaseModel, ConfigDict, Field

class QuestionOptionsRequest(BaseModel):
    options_text: str = Field(..., description="The text of the option for the question.")
    is_correct: bool = Field(..., description="Indicates whether the option is the correct answer for the question.")
    