from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

class UpcomingExamResponse(BaseModel):
    exam_id: str = Field(..., description="The unique identifier for the upcoming exam.")
    title: str = Field(..., description="The title of the upcoming exam.")
    subject: str = Field(..., description="The subject associated with the upcoming exam.")
    start_time: datetime = Field(..., description="The start time of the upcoming exam in ISO 8601 format.")
    end_time: datetime = Field(..., description="The end time of the upcoming exam in ISO 8601 format.")