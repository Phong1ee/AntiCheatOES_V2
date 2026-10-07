from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from src.a_db_config import Attempt, AttemptQuestion, AttemptStatus, EssayAnswer, Exam, ExamEvent, ExamSetting, MCQAnswer
from src.a_db_config.config import get_db_connection
from src.middleware.authMiddleware import verify_token
from src.service.audit_service import record_audit
from src.service.result_strategy_service import (
    representative_attempt,
    submitted_attempts_by_student,
    sync_student_final_score,
)

router = APIRouter(prefix="/anti-cheat")


class LockAttemptRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=255)


class TerminateAttemptRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=255)

CAMERA_AI_EVENT_TYPES = "'NO_FACE_DETECTED','MULTIPLE_FACES_DETECTED','GAZE_AWAY_SUSTAINED','HEAD_AWAY_SUSTAINED'"
AUDIO_EVENT_TYPES = "'MULTIPLE_VOICES_DETECTED','MIC_TRACK_MUTED','MIC_TRACK_ENDED'"
AI_EVENT_TYPES = f"{CAMERA_AI_EVENT_TYPES},{AUDIO_EVENT_TYPES}"

ATTEMPT_EVENT_SUMMARY_JOIN = f"""
LEFT JOIN (
    SELECT ee.attempt_id,
        MAX(CASE WHEN is_violation=1 THEN event_timestamp END) lastViolationAt,
        SUM(CASE WHEN event_type IN ({CAMERA_AI_EVENT_TYPES}) THEN 1 ELSE 0 END) cameraFlagCount,
        SUM(CASE WHEN event_type IN ({AUDIO_EVENT_TYPES}) THEN 1 ELSE 0 END) audioFlagCount,
        SUM(CASE WHEN source='browser' AND is_violation=1 THEN 1 ELSE 0 END) browserViolationCount,
        SUM(CASE WHEN event_type IN ({AI_EVENT_TYPES}) THEN 1 ELSE 0 END) aiFlagCount
    FROM exam_event ee
    JOIN attempt summary_attempt ON summary_attempt.attempt_id=ee.attempt_id
    WHERE summary_attempt.exam_id=%s
    GROUP BY ee.attempt_id
) event_summary ON event_summary.attempt_id=a.attempt_id
LEFT JOIN exam_event latest_event ON latest_event.event_id=(
    SELECT ee.event_id FROM exam_event ee
    WHERE ee.attempt_id=a.attempt_id
    ORDER BY ee.event_timestamp DESC,ee.event_id DESC LIMIT 1
)
"""

def teacher(user=Depends(verify_token)):
    if user.get("role") != "teacher": raise HTTPException(403, "Teacher access required")
    return user

def rows(query, params=()):
    cnx=get_db_connection(); cur=cnx.cursor(dictionary=True)
    try:
        cur.execute(query, params)
        return [{key: _repair_text(value) for key, value in row.items()} for row in cur.fetchall()]
    finally: cur.close(); cnx.close()

def _repair_text(value):
    """Repair legacy UTF-8 bytes that were previously decoded as latin-1."""
    if not isinstance(value, str) or not any(marker in value for marker in ("Ã", "Ä", "Â", "áº")):
        return value
    try:
        return value.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return value

def owned_exam(exam_id, school_id):
    result=rows("SELECT exam_id, subject_id FROM exam WHERE exam_id=%s AND manage_by=%s", (exam_id, school_id))
    if not result: raise HTTPException(404, "Exam not found or not authorized")
    return result[0]

@router.get("/subjects")
def subjects(user=Depends(teacher)):
    return rows("""SELECT s.subject_id subjectId, s.subject_id code, s.subject_name name,
    COUNT(DISTINCT CASE WHEN es.exam_id IS NOT NULL THEN e.exam_id END) antiCheatExamCount FROM teacher_subject ts JOIN subject s ON s.subject_id=ts.subject_id
    LEFT JOIN exam e ON e.subject_id=s.subject_id AND e.manage_by=ts.teacher_id
    LEFT JOIN exam_setting es ON es.exam_id=e.exam_id AND es.anti_cheat_enabled=1
    WHERE ts.teacher_id=%s GROUP BY s.subject_id,s.subject_name ORDER BY s.subject_id""", (user["school_id"],))

@router.get("/subjects/{subject_id}/exams")
def exams(subject_id: str, user=Depends(teacher)):
    return rows("""SELECT e.exam_id examId,e.title,e.start_time startTime,e.end_time endTime,
    COALESCE(es.anti_cheat_enabled,0) antiCheatEnabled,COALESCE(es.violation_limit,5) violationLimit
    FROM exam e JOIN teacher_subject ts ON ts.subject_id=e.subject_id AND ts.teacher_id=e.manage_by
    LEFT JOIN exam_setting es ON es.exam_id=e.exam_id WHERE e.subject_id=%s AND e.manage_by=%s ORDER BY e.start_time DESC""", (subject_id,user["school_id"]))

@router.get("/exams/{exam_id}/attempts")
def attempts(exam_id:int, search:str="", status:str="", limit:int=Query(50,ge=1,le=100), offset:int=Query(0,ge=0), user=Depends(teacher)):
    owned_exam(exam_id,user["school_id"])
    return rows(f"""SELECT a.attempt_id attemptId,a.student_id studentId,u.full_name studentName,a.attempt_no attemptNo,a.status attemptStatus,a.start_time startTime,a.submitted_at submittedAt,a.last_heartbeat_at lastHeartbeatAt,a.is_locked isLocked,a.locked_at lockedAt,a.locked_by lockedBy,a.lock_reason lockReason,a.score,a.violation_count violationCount,COALESCE(es.violation_limit,5) violationLimit,a.termination_reason terminationReason,
    latest_event.event_type latestEventType,latest_event.event_timestamp latestEventAt,event_summary.lastViolationAt,
    COALESCE(event_summary.cameraFlagCount,0) cameraFlagCount,COALESCE(event_summary.audioFlagCount,0) audioFlagCount,COALESCE(event_summary.browserViolationCount,0) browserViolationCount,
    COALESCE(event_summary.aiFlagCount,0) aiFlagCount,CASE WHEN COALESCE(event_summary.aiFlagCount,0)>0 THEN 1 ELSE 0 END flagged
    FROM attempt a JOIN user u ON u.school_id=a.student_id LEFT JOIN exam_setting es ON es.exam_id=a.exam_id
    {ATTEMPT_EVENT_SUMMARY_JOIN}
    WHERE a.exam_id=%s AND (%s='' OR u.full_name LIKE CONCAT('%%',%s,'%%') OR a.student_id LIKE CONCAT('%%',%s,'%%')) AND (%s='' OR a.status=%s) ORDER BY a.attempt_id DESC LIMIT %s OFFSET %s""",(exam_id,exam_id,search,search,search,status,status,limit,offset))

@router.get("/exams/{exam_id}/students")
def students(exam_id: int, user=Depends(teacher)):
    """Return assigned students and their latest active-attempt liveness."""
    owned_exam(exam_id, user["school_id"])
    return rows("""SELECT se.student_id studentId, u.full_name studentName, COUNT(a.attempt_id) attemptCount,
    active.attempt_id activeAttemptId, active.last_heartbeat_at lastHeartbeatAt,
    COALESCE(active.is_locked, 0) isLocked, active.lock_reason lockReason,
    CASE
        WHEN active.attempt_id IS NULL THEN 'not-started'
        WHEN active.is_locked = 1 THEN 'locked'
        WHEN active.last_heartbeat_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND) THEN 'active'
        ELSE 'offline'
    END activityStatus
    FROM student_exam se JOIN user u ON u.school_id=se.student_id
    LEFT JOIN attempt a ON a.exam_id=se.exam_id AND a.student_id=se.student_id
    LEFT JOIN attempt active ON active.attempt_id = (
        SELECT candidate.attempt_id FROM attempt candidate
        WHERE candidate.exam_id=se.exam_id AND candidate.student_id=se.student_id
          AND candidate.status='in_progress' AND candidate.submitted_at IS NULL AND candidate.end_time IS NULL
        ORDER BY candidate.attempt_id DESC LIMIT 1
    )
    WHERE se.exam_id=%s
    GROUP BY se.student_id,u.full_name,active.attempt_id,active.last_heartbeat_at,active.is_locked,active.lock_reason
    ORDER BY u.full_name,se.student_id""", (exam_id,))

@router.get("/exams/{exam_id}/students/{student_id}/attempts")
def student_attempts(
    exam_id: int,
    student_id: str,
    page: int = Query(1, ge=1),
    user=Depends(teacher),
    db: Session = Depends(get_db),
):
    """Return a selected assigned student's attempts, with a stable server-side page size."""
    owned_exam(exam_id, user["school_id"])
    assigned = rows("SELECT 1 FROM student_exam WHERE exam_id=%s AND student_id=%s", (exam_id, student_id))
    if not assigned:
        raise HTTPException(404, "Student is not assigned to this exam")
    page_size = 10
    total = rows("SELECT COUNT(*) total FROM attempt WHERE exam_id=%s AND student_id=%s", (exam_id, student_id))[0]["total"]
    offset = (page - 1) * page_size
    items = rows(f"""SELECT a.attempt_id attemptId,a.student_id studentId,u.full_name studentName,a.attempt_no attemptNo,a.status attemptStatus,a.start_time startTime,a.submitted_at submittedAt,a.last_heartbeat_at lastHeartbeatAt,a.is_locked isLocked,a.locked_at lockedAt,a.locked_by lockedBy,a.lock_reason lockReason,a.score,a.violation_count violationCount,COALESCE(es.violation_limit,5) violationLimit,a.termination_reason terminationReason,
    latest_event.event_type latestEventType,latest_event.event_timestamp latestEventAt,event_summary.lastViolationAt,
    COALESCE(event_summary.cameraFlagCount,0) cameraFlagCount,COALESCE(event_summary.audioFlagCount,0) audioFlagCount,COALESCE(event_summary.browserViolationCount,0) browserViolationCount,
    COALESCE(event_summary.aiFlagCount,0) aiFlagCount,CASE WHEN COALESCE(event_summary.aiFlagCount,0)>0 THEN 1 ELSE 0 END flagged
    FROM attempt a JOIN user u ON u.school_id=a.student_id LEFT JOIN exam_setting es ON es.exam_id=a.exam_id
    {ATTEMPT_EVENT_SUMMARY_JOIN}
    WHERE a.exam_id=%s AND a.student_id=%s ORDER BY a.attempt_id DESC LIMIT %s OFFSET %s""", (exam_id, exam_id, student_id, page_size, offset))

    # Mark which attempts feed the final score, reusing the same service the
    # grading pipeline uses so the monitor cannot disagree with the result.
    setting = db.get(ExamSetting, exam_id)
    strategy = setting.result_strategy.value if setting and setting.result_strategy else "highest"
    counting = submitted_attempts_by_student(db, exam_id, student_id).get(student_id, [])
    counting_ids = {attempt.attempt_id for attempt in counting}
    # "average" blends every counting attempt, so no single one is the result.
    final = representative_attempt(strategy, counting) if strategy != "average" else None
    final_id = final.attempt_id if final else None
    for item in items:
        item["countsTowardResult"] = item["attemptId"] in counting_ids
        item["isFinalResult"] = item["attemptId"] == final_id

    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": (total + page_size - 1) // page_size,
        "resultStrategy": strategy,
        # Exposed page-independently so the UI can jump to it even when the
        # attempt falls on another page.
        "finalAttemptId": final_id,
    }

@router.get("/attempts/{attempt_id}")
def detail(attempt_id:int,user=Depends(teacher)):
    # aiFlagCount/flagged are part of the MonitorAttempt contract, so this must
    # summarise events the same way the list endpoints do.
    base=rows(f"""SELECT a.attempt_id attemptId,a.student_id studentId,u.full_name studentName,a.attempt_no attemptNo,a.status attemptStatus,a.last_heartbeat_at lastHeartbeatAt,a.is_locked isLocked,a.locked_at lockedAt,a.locked_by lockedBy,a.lock_reason lockReason,a.score,a.violation_count violationCount,a.termination_reason terminationReason,e.exam_id examId,e.title,COALESCE(es.anti_cheat_enabled,0) antiCheatEnabled,COALESCE(es.violation_limit,5) violationLimit,
    COALESCE(ev.aiFlagCount,0) aiFlagCount,CASE WHEN COALESCE(ev.aiFlagCount,0)>0 THEN 1 ELSE 0 END flagged,
    COALESCE(ev.cameraFlagCount,0) cameraFlagCount,COALESCE(ev.audioFlagCount,0) audioFlagCount,COALESCE(ev.browserViolationCount,0) browserViolationCount
    FROM attempt a JOIN exam e ON e.exam_id=a.exam_id JOIN user u ON u.school_id=a.student_id LEFT JOIN exam_setting es ON es.exam_id=e.exam_id
    LEFT JOIN (
        SELECT attempt_id,
            SUM(CASE WHEN event_type IN ({AI_EVENT_TYPES}) THEN 1 ELSE 0 END) aiFlagCount,
            SUM(CASE WHEN event_type IN ({CAMERA_AI_EVENT_TYPES}) THEN 1 ELSE 0 END) cameraFlagCount,
            SUM(CASE WHEN event_type IN ({AUDIO_EVENT_TYPES}) THEN 1 ELSE 0 END) audioFlagCount,
            SUM(CASE WHEN source='browser' AND is_violation=1 THEN 1 ELSE 0 END) browserViolationCount
        FROM exam_event WHERE attempt_id=%s GROUP BY attempt_id
    ) ev ON ev.attempt_id=a.attempt_id
    WHERE a.attempt_id=%s AND e.manage_by=%s""",(attempt_id,attempt_id,user["school_id"]))
    if not base: raise HTTPException(404,"Attempt not found or not authorized")
    return {"attempt":base[0],"breakdown":rows("SELECT event_type eventType,COUNT(*) count FROM exam_event WHERE attempt_id=%s AND is_violation=1 GROUP BY event_type",(attempt_id,)),"timeline":rows("SELECT event_type eventType,event_timestamp eventTimestamp,source,details,metadata,is_violation isViolation FROM exam_event WHERE attempt_id=%s ORDER BY event_timestamp,event_id",(attempt_id,))}


def _owned_active_attempt_for_update(db: Session, attempt_id: int, teacher_id: str) -> Attempt:
    attempt = (
        db.query(Attempt)
        .join(Exam, Exam.exam_id == Attempt.exam_id)
        .filter(Attempt.attempt_id == attempt_id, Exam.manage_by == teacher_id)
        .with_for_update()
        .first()
    )
    if attempt is None:
        raise HTTPException(404, "Attempt not found or not authorized")
    if attempt.status != AttemptStatus.in_progress or attempt.submitted_at or attempt.end_time:
        raise HTTPException(409, "Only an in-progress attempt can be managed")
    return attempt


@router.post("/attempts/{attempt_id}/lock")
def lock_attempt(attempt_id: int, payload: LockAttemptRequest, user=Depends(teacher), db: Session = Depends(get_db)):
    try:
        attempt = _owned_active_attempt_for_update(db, attempt_id, user["school_id"])
        if attempt.is_locked:
            raise HTTPException(409, "Attempt is already locked")
        reason = (payload.reason or "Teacher temporarily locked this attempt").strip()
        now = datetime.now()
        attempt.is_locked = True
        attempt.locked_at = now
        attempt.locked_by = user["school_id"]
        attempt.lock_reason = reason
        # A teacher can lock again while the student is still on the
        # post-unlock confirmation screen.  Preserve the original pause start
        # so that entire interval stays excluded from the duration timer.
        if getattr(attempt, "paused_at", None) is None:
            attempt.paused_at = now
        attempt.awaiting_student_resume = False
        db.add(ExamEvent(
            attempt_id=attempt_id, event_type="ATTEMPT_LOCKED", event_timestamp=now,
            details=reason, source="system", is_violation=False,
            metadata_={"actorSchoolId": user["school_id"]},
        ))
        record_audit(
            db, actor_school_id=user["school_id"], actor_role=user.get("role"),
            action="ATTEMPT_LOCKED", entity_type="attempt", entity_id=attempt_id,
            metadata={"exam_id": attempt.exam_id, "student_id": attempt.student_id, "reason": reason},
        )
        db.commit()
        return {"success": True, "attemptId": attempt_id, "isLocked": True, "lockReason": reason}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/attempts/{attempt_id}/unlock")
def unlock_attempt(attempt_id: int, user=Depends(teacher), db: Session = Depends(get_db)):
    try:
        attempt = _owned_active_attempt_for_update(db, attempt_id, user["school_id"])
        if not attempt.is_locked:
            raise HTTPException(409, "Attempt is not locked")
        previous_reason = attempt.lock_reason
        attempt.is_locked = False
        attempt.locked_at = None
        attempt.locked_by = None
        attempt.lock_reason = None
        # Keep paused_at until the student explicitly confirms continuation.
        attempt.awaiting_student_resume = True
        db.add(ExamEvent(
            attempt_id=attempt_id, event_type="ATTEMPT_UNLOCKED", event_timestamp=datetime.now(),
            details=previous_reason, source="system", is_violation=False,
            metadata_={"actorSchoolId": user["school_id"]},
        ))
        record_audit(
            db, actor_school_id=user["school_id"], actor_role=user.get("role"),
            action="ATTEMPT_UNLOCKED", entity_type="attempt", entity_id=attempt_id,
            metadata={"exam_id": attempt.exam_id, "student_id": attempt.student_id},
        )
        db.commit()
        return {"success": True, "attemptId": attempt_id, "isLocked": False}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/attempts/{attempt_id}/terminate")
def terminate_attempt(attempt_id: int, payload: TerminateAttemptRequest, user=Depends(teacher), db: Session = Depends(get_db)):
    try:
        attempt = _owned_active_attempt_for_update(db, attempt_id, user["school_id"])
        reason = payload.reason.strip()
        if not reason:
            raise HTTPException(422, "Termination reason is required")
        termination_reason = f"teacher_terminated: {reason}"
        db.query(EssayAnswer).filter(EssayAnswer.attempt_id == attempt_id, EssayAnswer.score.is_(None)).update(
            {EssayAnswer.score: 0}, synchronize_session=False
        )
        attempt.score = 0
        attempt.status = AttemptStatus.terminated
        attempt.end_time = datetime.now()
        attempt.submitted_at = datetime.now()
        attempt.termination_reason = termination_reason
        attempt.is_locked = False
        attempt.locked_at = None
        attempt.locked_by = None
        attempt.lock_reason = None
        attempt.paused_at = None
        attempt.awaiting_student_resume = False
        attempt.score_scale_version = 3
        db.add(ExamEvent(
            attempt_id=attempt_id, event_type="ATTEMPT_TERMINATED", event_timestamp=datetime.now(),
            details=termination_reason, source="system", is_violation=False,
            metadata_={"actorSchoolId": user["school_id"], "terminationSource": "teacher"},
        ))
        exam = db.get(Exam, attempt.exam_id)
        if exam is not None and attempt.student_id is not None:
            sync_student_final_score(db, exam, attempt.student_id)
        record_audit(
            db, actor_school_id=user["school_id"], actor_role=user.get("role"),
            action="ATTEMPT_TERMINATED_BY_TEACHER", entity_type="attempt", entity_id=attempt_id,
            metadata={"exam_id": attempt.exam_id, "student_id": attempt.student_id, "reason": reason},
        )
        db.commit()
        return {"success": True, "attemptId": attempt_id, "attemptStatus": "terminated"}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

@router.delete("/attempts/{attempt_id}", status_code=status.HTTP_200_OK)
def delete_attempt(attempt_id: int, user=Depends(teacher), db: Session = Depends(get_db)):
    """Permanently remove one owned attempt and its answers/events, then resync the student's final score."""
    try:
        attempt = (
            db.query(Attempt)
            .join(Exam, Exam.exam_id == Attempt.exam_id)
            .filter(Attempt.attempt_id == attempt_id, Exam.manage_by == user["school_id"])
            .first()
        )
        if not attempt:
            raise HTTPException(404, "Attempt not found or not authorized")
        if attempt.status.value == "in_progress":
            raise HTTPException(409, "Cannot delete an attempt while it is in progress")

        exam_id, student_id = attempt.exam_id, attempt.student_id
        db.query(MCQAnswer).filter(MCQAnswer.attempt_id == attempt_id).delete(synchronize_session=False)
        db.query(EssayAnswer).filter(EssayAnswer.attempt_id == attempt_id).delete(synchronize_session=False)
        db.query(ExamEvent).filter(ExamEvent.attempt_id == attempt_id).delete(synchronize_session=False)
        db.query(AttemptQuestion).filter(AttemptQuestion.attempt_id == attempt_id).delete(synchronize_session=False)
        db.query(Attempt).filter(Attempt.attempt_id == attempt_id).delete(synchronize_session=False)

        exam = db.get(Exam, exam_id)
        if exam is not None and student_id is not None:
            sync_student_final_score(db, exam, student_id)

        record_audit(
            db,
            actor_school_id=user["school_id"],
            actor_role=user.get("role"),
            action="ATTEMPT_DELETED",
            entity_type="attempt",
            entity_id=attempt_id,
            metadata={"exam_id": exam_id, "student_id": student_id},
        )
        db.commit()
        return {"success": True, "message": "Attempt deleted"}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Attempt could not be deleted because dependent data remains") from exc

