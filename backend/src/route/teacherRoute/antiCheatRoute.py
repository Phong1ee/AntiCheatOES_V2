from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from src.a_db_config import ExamSetting
from src.a_db_config.config import get_db_connection
from src.middleware.authMiddleware import verify_token
from src.service.result_strategy_service import (
    representative_attempt,
    submitted_attempts_by_student,
)

router = APIRouter(prefix="/anti-cheat")

CAMERA_AI_EVENT_TYPES = "'NO_FACE_DETECTED','MULTIPLE_FACES_DETECTED','GAZE_AWAY_SUSTAINED','HEAD_AWAY_SUSTAINED'"
AUDIO_EVENT_TYPES = "'SPEECH_ACTIVITY_DETECTED','MULTIPLE_VOICES_DETECTED','MIC_TRACK_MUTED','MIC_TRACK_ENDED'"
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
    return rows(f"""SELECT a.attempt_id attemptId,a.student_id studentId,u.full_name studentName,a.attempt_no attemptNo,a.status attemptStatus,a.start_time startTime,a.submitted_at submittedAt,a.score,a.violation_count violationCount,COALESCE(es.violation_limit,5) violationLimit,a.termination_reason terminationReason,
    latest_event.event_type latestEventType,latest_event.event_timestamp latestEventAt,event_summary.lastViolationAt,
    COALESCE(event_summary.cameraFlagCount,0) cameraFlagCount,COALESCE(event_summary.audioFlagCount,0) audioFlagCount,COALESCE(event_summary.browserViolationCount,0) browserViolationCount,
    COALESCE(event_summary.aiFlagCount,0) aiFlagCount,CASE WHEN COALESCE(event_summary.aiFlagCount,0)>0 THEN 1 ELSE 0 END flagged
    FROM attempt a JOIN user u ON u.school_id=a.student_id LEFT JOIN exam_setting es ON es.exam_id=a.exam_id
    {ATTEMPT_EVENT_SUMMARY_JOIN}
    WHERE a.exam_id=%s AND (%s='' OR u.full_name LIKE CONCAT('%%',%s,'%%') OR a.student_id LIKE CONCAT('%%',%s,'%%')) AND (%s='' OR a.status=%s) ORDER BY a.attempt_id DESC LIMIT %s OFFSET %s""",(exam_id,exam_id,search,search,search,status,status,limit,offset))

@router.get("/exams/{exam_id}/students")
def students(exam_id: int, user=Depends(teacher)):
    """Return only the students explicitly assigned to this teacher's exam."""
    owned_exam(exam_id, user["school_id"])
    return rows("""SELECT se.student_id studentId, u.full_name studentName, COUNT(a.attempt_id) attemptCount
    FROM student_exam se JOIN user u ON u.school_id=se.student_id
    LEFT JOIN attempt a ON a.exam_id=se.exam_id AND a.student_id=se.student_id
    WHERE se.exam_id=%s GROUP BY se.student_id,u.full_name ORDER BY u.full_name,se.student_id""", (exam_id,))

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
    items = rows(f"""SELECT a.attempt_id attemptId,a.student_id studentId,u.full_name studentName,a.attempt_no attemptNo,a.status attemptStatus,a.start_time startTime,a.submitted_at submittedAt,a.score,a.violation_count violationCount,COALESCE(es.violation_limit,5) violationLimit,a.termination_reason terminationReason,
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
    base=rows(f"""SELECT a.attempt_id attemptId,a.student_id studentId,u.full_name studentName,a.attempt_no attemptNo,a.status attemptStatus,a.score,a.violation_count violationCount,a.termination_reason terminationReason,e.exam_id examId,e.title,COALESCE(es.anti_cheat_enabled,0) antiCheatEnabled,COALESCE(es.violation_limit,5) violationLimit,
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
