from pydantic import BaseModel, ConfigDict, Field
from src.models.teacher.requestModel.QuestionOptionsRequest import QuestionOptionsRequest

class QuestionAddToExamRequest(BaseModel):
    exam_id: int = Field(..., description="The ID of the exam to which the question will be added.")
    question_id: int = Field(..., description="The ID of the question to be added to the exam.")
    question_point: int = Field(..., description="The points assigned to the question in the exam.")
    options: list[QuestionOptionsRequest] = Field(..., description="A list of options for the question, each containing option text and a flag indicating if it's correct.")
    