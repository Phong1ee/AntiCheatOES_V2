from fastapi import APIRouter, HTTPException, Depends, Header
import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from src.controller.teacherController.examController import ExamController
from src.models.teacher.examModel import ALLOWED_CLIENT_EVENT_TYPES
#from src.controller.authController import ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY
from src.middleware.authMiddleware import verify_token, ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY

router = APIRouter()

class VerifyCodeRequest(BaseModel):
    code: str | None = None


class StartExamRequest(VerifyCodeRequest):
    deviceId: str = Field(min_length=1, max_length=255)


class ResumeAttemptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deviceId: str = Field(min_length=1, max_length=255)
    resumeCause: Literal["page_refresh", "unexpected_exit", "normal_resume"]
    clientEventId: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode="after")
    def require_refresh_id(self):
        if self.resumeCause == "page_refresh" and not self.clientEventId:
            raise ValueError("clientEventId is required for page_refresh")
        return self

class SubmitAnswerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    questionId: int
    selectedOptionId: int | None = None
    answerText: str | None = None

class SubmitExamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    attemptId: int = Field(alias="attempt_id")
    answers: list[SubmitAnswerRequest]
    timeSpentSeconds: int | None = None


class AutoSaveAnswerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selectedOptionId: int | None = None
    answerText: str | None = None


class TerminateAttemptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str
    violationType: str | None = None
    answers: list[SubmitAnswerRequest] = []
    timeSpentSeconds: int | None = None


class AntiCheatEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attemptId: int = Field(gt=0)
    clientEventId: str = Field(min_length=1, max_length=64)
    eventType: str = Field(min_length=1, max_length=50)
    source: Literal["browser", "camera", "microphone"]
    details: str | None = Field(default=None, max_length=1000)
    metadata: dict[str, object] | None = None
    answers: list[SubmitAnswerRequest] = Field(default_factory=list)

    @field_validator("eventType")
    @classmethod
    def validate_client_event_type(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in ALLOWED_CLIENT_EVENT_TYPES:
            raise ValueError("Unsupported or system-only anti-cheat event type")
        return normalized

    @model_validator(mode="after")
    def bound_metadata(self):
        if self.metadata is not None:
            encoded = json.dumps(self.metadata, separators=(",", ":"))
            if len(encoded.encode("utf-8")) > 4096:
                raise ValueError("metadata must not exceed 4096 bytes")
        return self


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
async def get_student_exams(current_user: dict = Depends(verify_token), role_check: dict = Depends(STUDENT_ONLY)):
    """Get all exams assigned to the current student."""
    result = ExamController.getStudentExams(
        current_user["school_id"],
        current_user["role"]
    )
    return result



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
    request: StartExamRequest,
    current_user: dict = Depends(verify_token)
):
    """Start exam and create or reuse an attempt."""
    try:
        return ExamController.startExam(
            current_user["school_id"],
            current_user["role"],
            exam_id,
            request.code, request.deviceId
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
    current_user: dict = Depends(verify_token),
    device_id: str = Header(min_length=1, alias="X-Device-Id"),
    attempt_session: str = Header(min_length=1, alias="X-Attempt-Session"),
):
    """Submit an exam attempt and close it."""
    try:
        return ExamController.submitExam(
            current_user["school_id"],
            current_user["role"],
            exam_id,
            request.attemptId,
            [answer.model_dump() for answer in request.answers], device_id, attempt_session
        )
    except Exception as e:
        detail = str(e)
        if detail == "Complete the current question before moving to the next question":
            raise HTTPException(status_code=409, detail=detail)
        if detail in {"Only students can submit exams", "Attempt does not belong to student"}:
            raise HTTPException(status_code=403, detail=detail)
        if detail in {"User not found", "Attempt not found"}:
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.post("/{exam_id}/events")
async def record_anti_cheat_event(
    exam_id: int,
    request: AntiCheatEventRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(STUDENT_ONLY),
    device_id: str = Header(min_length=1, alias="X-Device-Id"),
    attempt_session: str = Header(min_length=1, alias="X-Attempt-Session"),
):
    """Record one bounded client event; the backend classifies and enforces it."""
    del role_check
    try:
        return ExamController.recordAntiCheatEvent(
            current_user["school_id"], current_user["role"], exam_id, request.model_dump(),
            device_id, attempt_session,
        )
    except Exception as exc:
        detail = str(exc)
        if detail in {"Only students can manage exam attempts", "Attempt does not belong to student"}:
            raise HTTPException(status_code=403, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.put("/{exam_id}/attempts/{attempt_id}/answers/{question_id}")
async def save_answer(
    exam_id: int,
    attempt_id: int,
    question_id: int,
    request: AutoSaveAnswerRequest,
    current_user: dict = Depends(verify_token),
    device_id: str = Header(min_length=1, alias="X-Device-Id"),
    attempt_session: str = Header(min_length=1, alias="X-Attempt-Session"),
):
    """Persist the student's latest answer for one attempt question."""
    try:
        return ExamController.saveAnswer(
            current_user["school_id"], current_user["role"], exam_id, attempt_id,
            question_id, request.model_dump(exclude_none=True), device_id, attempt_session,
        )
    except Exception as e:
        detail = str(e)
        if detail == "Complete the current question before moving to the next question":
            raise HTTPException(status_code=409, detail=detail)
        if detail in {"Only students can manage exam attempts", "Attempt does not belong to student"}:
            raise HTTPException(status_code=403, detail=detail)
        if detail in {"User not found", "Exam not found or not assigned to student"}:
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.post("/{exam_id}/attempts/{attempt_id}/terminate")
async def terminate_attempt(
    exam_id: int,
    attempt_id: int,
    request: TerminateAttemptRequest,
    current_user: dict = Depends(verify_token),
    device_id: str = Header(min_length=1, alias="X-Device-Id"),
    attempt_session: str = Header(min_length=1, alias="X-Attempt-Session"),
):
    """Finalize an attempt when an anti-cheat policy terminates it."""
    try:
        return ExamController.terminateAttempt(
            current_user["school_id"], current_user["role"], exam_id, attempt_id,
            request.reason, request.violationType,
            [answer.model_dump(exclude_none=True) for answer in request.answers],
            device_id, attempt_session,
        )
    except Exception as e:
        detail = str(e)
        if detail in {"Only students can manage exam attempts", "Attempt does not belong to student", "Client-controlled termination is not allowed"}:
            raise HTTPException(status_code=403, detail=detail)
        if detail in {"User not found", "Exam not found or not assigned to student", "Attempt not found"}:
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.get("/{exam_id}/attempts/{attempt_id}")
async def restore_attempt(
    exam_id: int,
    attempt_id: int,
    current_user: dict = Depends(verify_token),
    device_id: str = Header(min_length=1, alias="X-Device-Id"),
    attempt_session: str = Header(min_length=1, alias="X-Attempt-Session"),
):
    """Read an owned attempt snapshot without changing the attempt."""
    try:
        return ExamController.restoreAttempt(
            current_user["school_id"],
            current_user["role"],
            exam_id,
            attempt_id, device_id, attempt_session,
        )
    except Exception as e:
        detail = str(e)
        if detail in {"Only students can view assigned exams", "Attempt does not belong to student"}:
            raise HTTPException(status_code=403, detail=detail)
        if detail == "Exam not found or not assigned to student":
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.post("/{exam_id}/attempts/{attempt_id}/resume")
async def resume_attempt(
    exam_id: int,
    attempt_id: int,
    request: ResumeAttemptRequest,
    current_user: dict = Depends(verify_token),
    role_check: dict = Depends(STUDENT_ONLY),
):
    del role_check
    try:
        return ExamController.resumeAttempt(
            current_user["school_id"], current_user["role"], exam_id, attempt_id,
            request.deviceId, request.resumeCause, request.clientEventId,
        )
    except Exception as exc:
        detail = str(exc)
        raise HTTPException(status_code=403 if "device" in detail or "Attempt" in detail else 400, detail=detail)


@router.post("/{exam_id}/attempts/{attempt_id}/heartbeat")
async def heartbeat_attempt(
    exam_id: int,
    attempt_id: int,
    current_user: dict = Depends(verify_token),
    device_id: str = Header(min_length=1, alias="X-Device-Id"),
    attempt_session: str = Header(min_length=1, alias="X-Attempt-Session"),
):
    try:
        return ExamController.heartbeatAttempt(current_user["school_id"], current_user["role"], exam_id, attempt_id, device_id, attempt_session)
    except Exception as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.get("/{exam_id}")
async def get_exam(
    exam_id: int,
    attempt_id: int | None = None,
    current_user: dict = Depends(verify_token),
):
    """Get exam details with student-safe questions and options."""
    try:
        result = ExamController.getExamWithQuestions(
            current_user["school_id"],
            current_user["role"],
            exam_id,
            attempt_id,
        )
        return result
    except Exception as e:
        detail = str(e)
        if detail in {"Only students can view assigned exams", "Attempt does not belong to student"}:
            raise HTTPException(status_code=403, detail=detail)
        if detail == "Exam not found or not assigned to student":
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)

@router.get("/{student_id}/exams")
async def get_student_exams_by_id(student_id: str, current_user: dict = Depends(verify_token), role_check: dict = Depends(ADMIN_ONLY)):
    """Get all exams assigned to a specific student by their school ID."""
    result = ExamController.getStudentExams(
        student_id,
        current_user["role"]
    )
    return result
