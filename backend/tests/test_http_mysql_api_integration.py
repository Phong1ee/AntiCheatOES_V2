"""Opt-in HTTP integration test for the disposable ``oes-verify`` Compose stack.

The test deliberately reaches the running API through Nginx, while inspecting
the disposable MySQL database through a fresh session. It is never run against
development, staging, or production data.
"""

import json
import os
import unittest
from datetime import datetime, timedelta
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

from werkzeug.security import generate_password_hash

from database import SessionLocal
from src.a_db_config import (
    Attempt,
    Exam,
    ExamEvent,
    ExamQuestion,
    ExamSetting,
    ExamStatus,
    Option,
    Question,
    QuestionDifficulty,
    QuestionStatus,
    QuestionType,
    StudentExam,
    Subject,
    TeacherSubject,
    User,
    UserRole,
)


@unittest.skipUnless(
    os.getenv("RUN_HTTP_MYSQL_E2E") == "1",
    "requires the disposable oes-verify Compose topology",
)
class HttpMySqlApiIntegrationTests(unittest.TestCase):
    base_url = os.getenv("OES_HTTP_E2E_BASE_URL", "http://nginx")

    def request(self, method, path, body=None, token=None, headers=None):
        request_headers = {"Accept": "application/json"}
        if token:
            request_headers["Authorization"] = f"Bearer {token}"
        if headers:
            request_headers.update(headers)
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            request_headers["Content-Type"] = "application/json"
        request = Request(self.base_url + path, data=data, headers=request_headers, method=method)
        try:
            with urlopen(request, timeout=15) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            payload = exc.read().decode("utf-8")
            return exc.code, json.loads(payload) if payload else {}

    def login(self, email):
        status, payload = self.request("POST", "/api/auth/login", {"email": email, "password": "TestPassword!234"})
        self.assertEqual(status, 200, payload)
        self.assertIn("token", payload)
        return payload["token"]

    def setUp(self):
        suffix = uuid4().hex[:12]
        self.student_id = f"SHTTP{suffix}"
        self.teacher_id = f"THTTP{suffix}"
        self.other_teacher_id = f"TXHTTP{suffix}"
        self.admin_id = f"AHTTP{suffix}"
        self.subject_id = f"SUB{suffix[:10]}"
        self.student_email = f"student-{suffix}@http-e2e.test"
        self.teacher_email = f"teacher-{suffix}@http-e2e.test"
        self.other_teacher_email = f"other-{suffix}@http-e2e.test"
        self.admin_email = f"admin-{suffix}@http-e2e.test"
        password_hash = generate_password_hash("TestPassword!234")

        session = SessionLocal()
        try:
            session.add_all([
                User(school_id=self.student_id, full_name="HTTP Student", email=self.student_email, password_hash=password_hash, role=UserRole.student),
                User(school_id=self.teacher_id, full_name="HTTP Teacher", email=self.teacher_email, password_hash=password_hash, role=UserRole.teacher),
                User(school_id=self.other_teacher_id, full_name="HTTP Other Teacher", email=self.other_teacher_email, password_hash=password_hash, role=UserRole.teacher),
                User(school_id=self.admin_id, full_name="HTTP Admin", email=self.admin_email, password_hash=password_hash, role=UserRole.admin),
                Subject(subject_id=self.subject_id, subject_name="HTTP Integration Subject", subject_description="Disposable API contract data"),
            ])
            session.flush()
            session.add(TeacherSubject(teacher_id=self.teacher_id, subject_id=self.subject_id, assigned_by=self.admin_id, is_active=True))
            exam = Exam(
                manage_by=self.teacher_id,
                title="HTTP Integration Exam",
                max_attempt=1,
                duration_minutes=30,
                start_time=datetime.now() - timedelta(minutes=2),
                end_time=datetime.now() + timedelta(minutes=30),
                status=ExamStatus.published,
                subject_id=self.subject_id,
            )
            question = Question(
                question_text="HTTP integration MCQ",
                question_difficulties=QuestionDifficulty.easy,
                question_type=QuestionType.MCQ,
                subject_id=self.subject_id,
                created_by=self.teacher_id,
                question_status=QuestionStatus.approved,
            )
            session.add_all([exam, question])
            session.flush()
            option = Option(question_id=question.question_id, options_text="Correct option", is_correct=True)
            session.add_all([
                option,
                ExamQuestion(exam_id=exam.exam_id, question_id=question.question_id, question_point=10),
                ExamSetting(exam_id=exam.exam_id, anti_cheat_enabled=True, violation_limit=3),
                StudentExam(student_id=self.student_id, exam_id=exam.exam_id),
            ])
            session.commit()
            self.exam_id = exam.exam_id
            self.question_id = question.question_id
            self.option_id = option.options_id
        finally:
            session.close()

    def test_protected_contract_and_anti_cheat_trace(self):
        student_token = self.login(self.student_email)
        teacher_token = self.login(self.teacher_email)
        other_teacher_token = self.login(self.other_teacher_email)
        admin_token = self.login(self.admin_email)

        # Student protected read and attempt creation use the real HTTP contract.
        status, exams = self.request("GET", "/api/exams", token=student_token)
        self.assertEqual(status, 200, exams)
        self.assertTrue(any(item.get("exam_id") == self.exam_id for item in exams.get("exams", exams if isinstance(exams, list) else [])))

        status, started = self.request("POST", f"/api/exams/{self.exam_id}/start", {"deviceId": "http-e2e-device"}, student_token)
        self.assertEqual(status, 200, started)
        self.assertIn("attemptId", started)
        self.assertIn("sessionToken", started)
        attempt_id = started["attemptId"]
        attempt_headers = {"X-Device-Id": "http-e2e-device", "X-Attempt-Session": started["sessionToken"]}

        status, saved = self.request(
            "PUT", f"/api/exams/{self.exam_id}/attempts/{attempt_id}/answers/{self.question_id}",
            {"revision": 1, "selectedOptionId": self.option_id}, student_token, attempt_headers,
        )
        self.assertEqual(status, 200, saved)
        self.assertEqual(saved["storedRevision"], 1)

        # Teacher reads its permitted question bank; Admin gets a protected read.
        status, question_bank = self.request("GET", f"/api/teacher/question-bank?subject_id={self.subject_id}", token=teacher_token)
        self.assertEqual(status, 200, question_bank)
        self.assertTrue(any(item.get("questionId", item.get("question_id")) == self.question_id for item in question_bank["items"]))
        status, health = self.request("GET", "/api/admin/system-health", token=admin_token)
        self.assertEqual(status, 200, health)
        self.assertIn("status", health)

        event = {"attemptId": attempt_id, "clientEventId": "http-e2e-event-1", "eventType": "TAB_HIDDEN", "source": "browser", "metadata": {"reason": "controlled-test"}}
        status, first = self.request("POST", f"/api/exams/{self.exam_id}/events", event, student_token, attempt_headers)
        self.assertEqual(status, 200, first)
        self.assertEqual(first["violationCount"], 1)
        status, duplicate = self.request("POST", f"/api/exams/{self.exam_id}/events", event, student_token, attempt_headers)
        self.assertEqual(status, 200, duplicate)
        self.assertEqual(duplicate["violationCount"], 1)

        status, monitor = self.request("GET", f"/api/teacher/anti-cheat/attempts/{attempt_id}", token=teacher_token)
        self.assertEqual(status, 200, monitor)
        self.assertEqual(monitor["attempt"]["violationCount"], 1)
        self.assertTrue(any(item["eventType"] == "TAB_HIDDEN" for item in monitor["timeline"]))
        status, denied = self.request("GET", f"/api/teacher/anti-cheat/attempts/{attempt_id}", token=other_teacher_token)
        self.assertEqual(status, 404, denied)

        # New sessions prove the persistent MySQL state, independent of API memory.
        session = SessionLocal()
        try:
            attempt = session.get(Attempt, attempt_id)
            self.assertEqual(attempt.violation_count, 1)
            events = session.query(ExamEvent).filter(ExamEvent.attempt_id == attempt_id, ExamEvent.client_event_id == "http-e2e-event-1").all()
            self.assertEqual(len(events), 1)
            self.assertTrue(events[0].is_violation)
        finally:
            session.close()
