from pydantic import BaseModel
from datetime import datetime

class TeacherExam(BaseModel):
    exam_id: int
    title: str
    examcode: str
    description: str
    max_attempt: int
    duration_minutes: int
    start_time: datetime
    end_time: datetime
    totalStudents: int
    manage_by: str
    status: str
