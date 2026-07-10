from pydantic import BaseModel, ConfigDict, Field

class TeacherExamRequest(BaseModel):
    title: str = Field(..., description="The title of the exam.")
    examcode: str = Field(..., description="The unique code for the exam.")
    max_attemmpt: int = Field(..., description="The maximum number of attempts allowed for the exam.")
    description: str = Field(..., description="A brief description of the exam.")
    duration_minutes: int = Field(..., description="The duration of the exam in minutes.")
    result_visibility: str = Field(..., description="The visibility of the exam results (e.g., 'public', 'private').")
    subject_id: str = Field(..., description="The ID of the subject associated with the exam.")
    