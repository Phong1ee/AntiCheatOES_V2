from fastapi import APIRouter, Depends, HTTPException, Query
from src.a_db_config.config import get_db_connection
from src.middleware.authMiddleware import verify_token

router = APIRouter(prefix="/anti-cheat")

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
    return rows("""SELECT a.attempt_id attemptId,a.student_id studentId,u.full_name studentName,a.attempt_no attemptNo,a.status attemptStatus,a.score,a.violation_count violationCount,COALESCE(es.violation_limit,5) violationLimit,a.termination_reason terminationReason,
    (SELECT ee.event_type FROM exam_event ee WHERE ee.attempt_id=a.attempt_id ORDER BY ee.event_timestamp DESC,ee.event_id DESC LIMIT 1) lastEventType,
    (SELECT ee.event_timestamp FROM exam_event ee WHERE ee.attempt_id=a.attempt_id ORDER BY ee.event_timestamp DESC,ee.event_id DESC LIMIT 1) lastEventAt,
    EXISTS(SELECT 1 FROM exam_event ai WHERE ai.attempt_id=a.attempt_id AND ai.event_type IN ('NO_FACE_DETECTED','MULTIPLE_FACES_DETECTED','PHONE_DETECTED','SPEECH_ACTIVITY_DETECTED')) flagged,
    (SELECT COUNT(*) FROM exam_event ai WHERE ai.attempt_id=a.attempt_id AND ai.event_type IN ('NO_FACE_DETECTED','MULTIPLE_FACES_DETECTED','PHONE_DETECTED','SPEECH_ACTIVITY_DETECTED')) aiFlagCount
    FROM attempt a JOIN user u ON u.school_id=a.student_id LEFT JOIN exam_setting es ON es.exam_id=a.exam_id
    WHERE a.exam_id=%s AND (%s='' OR u.full_name LIKE CONCAT('%%',%s,'%%') OR a.student_id LIKE CONCAT('%%',%s,'%%')) AND (%s='' OR a.status=%s) ORDER BY a.attempt_id DESC LIMIT %s OFFSET %s""",(exam_id,search,search,search,status,status,limit,offset))

@router.get("/attempts/{attempt_id}")
def detail(attempt_id:int,user=Depends(teacher)):
    base=rows("""SELECT a.attempt_id attemptId,a.student_id studentId,u.full_name studentName,a.attempt_no attemptNo,a.status attemptStatus,a.score,a.violation_count violationCount,a.termination_reason terminationReason,e.exam_id examId,e.title,COALESCE(es.anti_cheat_enabled,0) antiCheatEnabled,COALESCE(es.violation_limit,5) violationLimit FROM attempt a JOIN exam e ON e.exam_id=a.exam_id JOIN user u ON u.school_id=a.student_id LEFT JOIN exam_setting es ON es.exam_id=e.exam_id WHERE a.attempt_id=%s AND e.manage_by=%s""",(attempt_id,user["school_id"]))
    if not base: raise HTTPException(404,"Attempt not found or not authorized")
    return {"attempt":base[0],"breakdown":rows("SELECT event_type eventType,COUNT(*) count FROM exam_event WHERE attempt_id=%s AND is_violation=1 GROUP BY event_type",(attempt_id,)),"timeline":rows("SELECT event_type eventType,event_timestamp eventTimestamp,source,details,metadata,is_violation isViolation FROM exam_event WHERE attempt_id=%s ORDER BY event_timestamp,event_id",(attempt_id,))}
