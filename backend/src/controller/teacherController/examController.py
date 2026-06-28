# import src.models.examModel as examModel
import src.models.default.userModel as userModel
import src.models.teacherModel.examModel as examModel
from datetime import datetime


class ExamController:
    @staticmethod
    def get_exams_by_teacher(teacher_id: str):
        """Get all exams created by a teacher."""
        try:
            exams = examModel.get_exams_by_teacher(teacher_id)
            return {
                "success": True,
                "exams": exams
            }
        except Exception as e:
            raise e