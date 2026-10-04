from src.models.teacher.requestModel.RichContentRequest import RichContentRequest
from pydantic import BaseModel, ConfigDict, Field

class QuestionOptionsRequest(RichContentRequest):
    options_id: int | None = Field(default=None, description="Existing option ID when updating an option.")
    options_text: str = Field(default="", max_length=60000, description="The text of the option for the question.")
    is_correct: bool = Field(..., description="Indicates whether the option is the correct answer for the question.")
    
