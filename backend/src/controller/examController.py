import src.models.examModel as examModel

class ExamController:
    @staticmethod
    def getStudentExams(school_id: str):
        """Get all exams assigned to a student."""
        try:
            exams = examModel.getStudentExams(school_id)
            return {
                "success": True,
                "exams": exams
            }
        except Exception as e:
            raise e
    
    @staticmethod
    def getExamWithQuestions(exam_id: int):
        """Get exam details along with all questions and options."""
        try:
            exam = examModel.getExamById(exam_id)
            if not exam:
                raise Exception(f"Exam with ID {exam_id} not found")
            
            questions = examModel.getExamQuestions(exam_id)
            
            return {
                "success": True,
                "exam": exam,
                "questions": questions
            }
        except Exception as e:
            raise e
    
    @staticmethod
    def getStudentExam(school_id: str):
        """Get exam details for a student based on their school ID."""
        try:
            exam_details = examModel.getExam()
            return {
                "success": True,
                "exam": exam_details
            }
        except Exception as e:
            raise e
    
    @staticmethod
    def get_exams_by_teacher(teacher_id: int):
        """Get all exams created by a teacher."""
        try:
            exams = examModel.get_exams_by_teacher(teacher_id)
            return {
                "success": True,
                "exams": exams
            }
        except Exception as e:
            raise e