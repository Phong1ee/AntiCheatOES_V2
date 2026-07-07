from pydantic import BaseModel, ConfigDict, Field

class TeacherExamRequest(BaseModel):
    exam_id: str = Field(..., description="The ID of the exam.")
    managed_by: str = Field(..., description="The ID of the teacher managing the exam.")
    title: str = Field(..., description="The title of the exam.")
    examcode: str = Field(..., description="The unique code for the exam.")
    max_attemmpts: int = Field(..., description="The maximum number of attempts allowed for the exam.")
    description: str = Field(..., description="A brief description of the exam.")
    duration_minutes: int = Field(..., description="The duration of the exam in minutes.")
    start_time: str = Field(..., description="The start time of the exam in ISO 8601 format.")
    end_time: str = Field(..., description="The end time of the exam in ISO 8601 format.")
    results_visibility: str = Field(..., description="The visibility of the exam results (e.g., 'public', 'private').")
    subject_id: int = Field(..., description="The ID of the subject associated with the exam.")