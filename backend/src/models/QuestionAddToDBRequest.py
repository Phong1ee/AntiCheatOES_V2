from pydantic import BaseModel, ConfigDict, Field

class QuestionAddToDBRequest(BaseModel):
    question_id: str = Field(..., description="The ID of the question to be added to the exam.")
    question_text: str = Field(..., description="The text of the question.")
    question_difficulties: str = Field(..., description="The difficulty level of the question.")
    question_type: str = Field(..., description="The type of the question (e.g., multiple-choice, essay).")
    chapter_id: int = Field(..., description="The ID of the chapter to which the question belongs.")
    created_by: str = Field(..., description="The ID of the user who created the question.")
    question_status: str = Field(..., description="The status of the question (e.g., active, inactive).")
    