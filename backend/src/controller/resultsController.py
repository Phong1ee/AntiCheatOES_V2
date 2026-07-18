import src.models.resultModel as resultModel
import src.models.userModel as userModel


class ResultsController:
    @staticmethod
    def get_results(school_id: str, role: str):
        if role != "student":
            raise Exception("Only students can view results")

        user = userModel.getUserBySchoolId(school_id)
        if not user:
            raise Exception("User not found")

        return {
            "success": True,
            "results": resultModel.get_student_results(user["id"]),
        }

    @staticmethod
    def get_result_detail(school_id: str, role: str, attempt_id: int):
        if role != "student":
            raise Exception("Only students can view results")

        user = userModel.getUserBySchoolId(school_id)
        if not user:
            raise Exception("User not found")

        result = resultModel.get_student_result_detail(user["id"], attempt_id)
        if not result:
            raise Exception("Result not found")

        return {
            "success": True,
            "result": result,
        }
