from pydantic import BaseModel, ConfigDict, Field

class QuestionBankOverviewResponse(BaseModel):
    subject_id: str = Field(..., description="The ID of the subject associated with the question.")
    subject_name: str = Field(..., description="The name of the subject associated with the question.")
    subject_description: str = Field(..., description="A brief description of the subject associated with the question.")
    question_count: int = Field(..., description="The total number of questions in the question bank for the subject.")