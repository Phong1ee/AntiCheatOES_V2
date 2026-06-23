from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict, Field
from src.controller.examController import ExamController
from src.middleware.authMiddleware import verify_token

router = APIRouter()


class VerifyCodeRequest(BaseModel):
    code: str


class SubmitAnswerRequest(BaseModel):
    questionId: int
    selectedOptionId: int | None = None
    answerText: str | None = None


class SubmitExamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    attemptId: int = Field(alias="attempt_id")
    answers: list[SubmitAnswerRequest]
    timeSpentSeconds: int | None = None


@router.get("")
async def get_student_exams_root(current_user: dict = Depends(verify_token)):
    """Get all exams assigned to the current student."""
    try:
        result = ExamController.getStudentExams(
            current_user["school_id"],
            current_user["role"]
        )
        return result
    except Exception as e:
        detail = str(e)
        status_code = 403 if detail == "Only students can view assigned exams" else 400
        raise HTTPException(status_code=status_code, detail=detail)


@router.get("/student")
async def get_student_exams(current_user: dict = Depends(verify_token)):
    """Get all exams assigned to the current student."""
    try:
        result = ExamController.getStudentExams(
            current_user["school_id"],
            current_user["role"]
        )
        return result
    except Exception as e:
        detail = str(e)
        status_code = 403 if detail == "Only students can view assigned exams" else 400
        raise HTTPException(status_code=status_code, detail=detail)


@router.post("/{exam_id}/verify-code")
async def verify_exam_code(
    exam_id: int,
    request: VerifyCodeRequest,
    current_user: dict = Depends(verify_token)
):
    """Verify exam code for an assigned student without creating an attempt."""
    try:
        return ExamController.verifyExamCode(
            current_user["school_id"],
            current_user["role"],
            exam_id,
            request.code
        )
    except Exception as e:
        detail = str(e)
        if detail in {"Only students can verify exam codes", "Exam not open yet", "Exam is not open yet", "Exam has closed", "Maximum attempts exceeded", "Exam not assigned to student"}:
            raise HTTPException(status_code=403, detail=detail)
        if detail == "Incorrect exam code":
            raise HTTPException(status_code=400, detail=detail)
        if detail in {"Exam not found", "User not found"}:
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.post("/{exam_id}/start")
async def start_exam(
    exam_id: int,
    request: VerifyCodeRequest,
    current_user: dict = Depends(verify_token)
):
    """Start exam and create or reuse an attempt."""
    try:
        return ExamController.startExam(
            current_user["school_id"],
            current_user["role"],
            exam_id,
            request.code
        )
    except Exception as e:
        detail = str(e)
        if detail in {"Only students can start exams", "Exam not open yet", "Exam is not open yet", "Exam has closed", "Maximum attempts exceeded", "Exam not assigned to student"}:
            raise HTTPException(status_code=403, detail=detail)
        if detail == "Incorrect exam code":
            raise HTTPException(status_code=400, detail=detail)
        if detail in {"Exam not found", "User not found"}:
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.post("/{exam_id}/submit")
async def submit_exam(
    exam_id: int,
    request: SubmitExamRequest,
    current_user: dict = Depends(verify_token)
):
    """Submit an exam attempt and close it."""
    try:
        return ExamController.submitExam(
            current_user["school_id"],
            current_user["role"],
            exam_id,
            request.attemptId,
            [answer.model_dump() for answer in request.answers]
        )
    except Exception as e:
        detail = str(e)
        if detail in {"Only students can submit exams", "Attempt does not belong to student"}:
            raise HTTPException(status_code=403, detail=detail)
        if detail in {"User not found", "Attempt not found"}:
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.get("/{exam_id}")
async def get_exam(exam_id: int, current_user: dict = Depends(verify_token)):
    """Get exam details with student-safe questions and options."""
    try:
        result = ExamController.getExamWithQuestions(
            current_user["school_id"],
            current_user["role"],
            exam_id
        )
        return result
    except Exception as e:
        detail = str(e)
        if detail == "Only students can view assigned exams":
            raise HTTPException(status_code=403, detail=detail)
        if detail == "Exam not found or not assigned to student":
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
