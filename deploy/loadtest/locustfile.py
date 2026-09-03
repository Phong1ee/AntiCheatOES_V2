"""Authenticated Locust workload for the disposable Compose load environment.

The companion seed creates only ``*.example.test`` accounts. This workload
never falls back to a shared account, so a misconfigured account pool fails
before authenticated requests are made.
"""

import os
import threading
import uuid
from datetime import datetime, timedelta

from locust import HttpUser, between, events, task
from locust.exception import StopUser


def _positive_int_env(name: str, default: int) -> int:
    value = os.getenv(name, str(default))
    try:
        result = int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a positive integer") from exc
    if result <= 0:
        raise RuntimeError(f"{name} must be a positive integer")
    return result


STUDENT_COUNT = _positive_int_env("LOADTEST_STUDENT_COUNT", 500)
TEACHER_COUNT = _positive_int_env("LOADTEST_TEACHER_COUNT", 5)
ADMIN_COUNT = _positive_int_env("LOADTEST_ADMIN_COUNT", 2)
PASSWORD_ENV = "LOADTEST_PASSWORD"
ACCOUNT_OFFSET_ENV = "LOADTEST_ACCOUNT_OFFSET"
TEACHER_ACCOUNT_OFFSET_ENV = "LOADTEST_TEACHER_ACCOUNT_OFFSET"
ADMIN_ACCOUNT_OFFSET_ENV = "LOADTEST_ADMIN_ACCOUNT_OFFSET"
_allocation_lock = threading.Lock()
_allocations: dict[str, int] = {"STUDENT": 0, "TEACHER": 0, "ADMIN": 0}
_audit_mutation_lock = threading.Lock()
_audit_mutation_started = False


def _account(role: str, index: int) -> str:
    if role == "STUDENT":
        return f"load.student.{index:04d}@example.test"
    return f"load.{role.lower()}.{index:03d}@example.test"


def _allocate(role: str) -> tuple[str, str]:
    limits = {"STUDENT": STUDENT_COUNT, "TEACHER": TEACHER_COUNT, "ADMIN": ADMIN_COUNT}
    offset_names = {
        "STUDENT": ACCOUNT_OFFSET_ENV,
        "TEACHER": TEACHER_ACCOUNT_OFFSET_ENV,
        "ADMIN": ADMIN_ACCOUNT_OFFSET_ENV,
    }
    with _allocation_lock:
        _allocations[role] += 1
        index = _allocations[role]
    offset_name = offset_names[role]
    offset = int(os.getenv(offset_name, "0"))
    if offset < 0:
        raise RuntimeError(f"{offset_name} must not be negative")
    requested_index = offset + index
    if requested_index > limits[role]:
        raise RuntimeError(
            f"{role.title()} account pool exhausted: requested {requested_index}, available {limits[role]}"
        )
    return _account(role, requested_index), os.environ[PASSWORD_ENV]


@events.test_start.add_listener
def _validate_load_configuration(environment, **_kwargs) -> None:
    if not os.getenv(PASSWORD_ENV):
        raise RuntimeError(f"{PASSWORD_ENV} is required for authenticated isolated load testing")
    requested_users = getattr(environment.parsed_options, "num_users", None)
    offsets = {
        "Student": (ACCOUNT_OFFSET_ENV, STUDENT_COUNT, 6),
        "Teacher": (TEACHER_ACCOUNT_OFFSET_ENV, TEACHER_COUNT, 3),
        "Admin": (ADMIN_ACCOUNT_OFFSET_ENV, ADMIN_COUNT, 1),
    }
    capacities = []
    for role, (offset_name, count, weight) in offsets.items():
        offset = int(os.getenv(offset_name, "0"))
        if offset < 0 or offset >= count:
            raise RuntimeError(f"{offset_name} must be between 0 and {count - 1}")
        capacities.append(((count - offset) * 10) // weight)
    max_users = min(capacities)
    if requested_users and requested_users > max_users:
        raise RuntimeError(
            f"Requested {requested_users} users exceeds the {STUDENT_COUNT}-Student "
            f"disposable workload capacity of {max_users} users"
        )


class BaseUser(HttpUser):
    abstract = True
    wait_time = between(0.2, 0.8)

    def on_start(self) -> None:
        self.role = self.__class__.__name__.replace("User", "").upper()
        self.token = None
        self.authenticated = False
        try:
            email, password = _allocate(self.role)
        except RuntimeError as exc:
            raise StopUser(str(exc)) from exc

        # Locust only permits explicit response.success()/failure() within this
        # context manager. The previous harness called failure on a normal
        # response object and crashed valid test stages with LocustError.
        with self.client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
            name=f"{self.role} login",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"login rejected: HTTP {response.status_code}")
                return
            try:
                token = response.json().get("token")
            except ValueError:
                token = None
            if not token:
                response.failure("login response did not include a token")
                return
            self.token = token
            self.authenticated = True
            response.success()

    def request(self, method: str, path: str, **kwargs):
        headers = dict(kwargs.pop("headers", {}))
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return self.client.request(method, path, headers=headers, **kwargs)

    @task(1)
    def health(self) -> None:
        self.request("GET", "/health/live", name="health live")


class StudentUser(BaseUser):
    weight = 6

    def on_start(self) -> None:
        super().on_start()
        self.device_id = f"load-device-{uuid.uuid4()}"
        self.attempt_id = None
        self.session_token = None
        self.question_id = None
        self.option_id = None
        self.revision = 0
        if self.authenticated:
            self._resolve_assigned_exam()

    def on_stop(self) -> None:
        """Close an active disposable attempt when Locust reaches its time limit."""
        if self.authenticated and self.attempt_id and self.question_id:
            self.submit_once()

    def _resolve_assigned_exam(self) -> None:
        """Use the account's actual assignment instead of assuming MySQL ID 1."""
        with self.request(
            "GET", "/api/exams/student", name="student assigned exams",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"assigned-exam read rejected: HTTP {response.status_code}")
                return
            payload = response.json()
            exams = payload.get("exams", payload if isinstance(payload, list) else [])
            if not exams:
                response.failure("load-test student has no assigned exam")
                return
            self.exam_id = exams[0].get("exam_id", exams[0].get("examId"))
            if not self.exam_id:
                response.failure("assigned-exam response did not include an exam ID")
                return
            response.success()
        self._start_attempt()

    def _start_attempt(self) -> None:
        with self.request(
            "POST",
            f"/api/exams/{self.exam_id}/start",
            json={"code": None, "deviceId": self.device_id},
            name="student start",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"start rejected: HTTP {response.status_code}")
                return
            payload = response.json()
            self.attempt_id = payload.get("attemptId")
            self.session_token = payload.get("sessionToken")
            if not self.attempt_id or not self.session_token:
                response.failure("start response did not include an active attempt session")
                return
            response.success()
        with self.request(
            "GET",
            f"/api/exams/{self.exam_id}?attempt_id={self.attempt_id}",
            name="student questions",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"question read rejected: HTTP {response.status_code}")
                return
            questions = response.json().get("questions", [])
            if not questions or not questions[0].get("options"):
                response.failure("seeded exam did not return an answerable MCQ")
                return
            self.question_id = questions[0]["question_id"]
            # Student payloads deliberately expose safe ``id`` fields, not
            # Teacher-only ``options_id`` / correctness data.
            self.option_id = questions[0]["options"][0]["id"]
            response.success()

    @task(5)
    def assigned_exams(self) -> None:
        if self.authenticated:
            self.request("GET", "/api/exams/student", name="student assigned exams")

    @task(2)
    def autosave(self) -> None:
        if not self.authenticated or not self.attempt_id or not self.question_id:
            return
        self.revision += 1
        with self.request(
            "PUT",
            f"/api/exams/{self.exam_id}/attempts/{self.attempt_id}/answers/{self.question_id}",
            json={"revision": self.revision, "selectedOptionId": self.option_id},
            headers={"X-Device-Id": self.device_id, "X-Attempt-Session": self.session_token},
            name="student autosave",
            catch_response=True,
        ) as response:
            if response.status_code >= 400:
                # Preserve a bounded server diagnostic in Locust evidence without
                # recording authentication material or full response bodies.
                detail = " ".join(response.text.split())[:240]
                response.failure(f"autosave rejected: HTTP {response.status_code}; {detail}")
            else:
                response.success()

    @task(1)
    def bounded_anti_cheat(self) -> None:
        if not self.authenticated or not self.attempt_id:
            return
        self.request(
            "POST",
            f"/api/exams/{self.exam_id}/events",
            json={
                "attemptId": self.attempt_id,
                "clientEventId": f"load-event-{self.attempt_id}",
                "eventType": "TAB_HIDDEN",
                "source": "browser",
                "details": "disposable load probe",
            },
            headers={"X-Device-Id": self.device_id, "X-Attempt-Session": self.session_token},
            name="student anti-cheat",
        )

    @task(1)
    def submit_once(self) -> None:
        if not self.authenticated or not self.attempt_id or not self.question_id:
            return
        with self.request(
            "POST",
            f"/api/exams/{self.exam_id}/submit",
            json={
                "attemptId": self.attempt_id,
                "submitRequestId": str(uuid.uuid4()),
                "answers": [{"questionId": self.question_id, "selectedOptionId": self.option_id}],
            },
            headers={"X-Device-Id": self.device_id, "X-Attempt-Session": self.session_token},
            name="student submit",
            catch_response=True,
        ) as response:
            if response.status_code >= 400:
                detail = " ".join(response.text.split())[:240]
                response.failure(f"submit rejected: HTTP {response.status_code}; {detail}")
            else:
                response.success()
        self.attempt_id = None


class TeacherUser(BaseUser):
    weight = 3

    @task(4)
    def exam_manager(self) -> None:
        if self.authenticated:
            self.request("GET", "/api/teacher/exams", name="teacher exams")

    @task(3)
    def question_bank(self) -> None:
        if self.authenticated:
            self.request("GET", "/api/teacher/question-bank", name="teacher question bank")

    @task(2)
    def monitor_subjects(self) -> None:
        if self.authenticated:
            self.request("GET", "/api/teacher/anti-cheat/subjects", name="teacher anti-cheat subjects")

    @task(1)
    def audited_disposable_mutation(self) -> None:
        """Exercise one real audited mutation without conflicting with exam traffic."""
        global _audit_mutation_started
        if not self.authenticated:
            return
        with _audit_mutation_lock:
            if _audit_mutation_started:
                return
            _audit_mutation_started = True
        now = datetime.now()
        with self.request(
            "POST",
            "/api/teacher/add_exam",
            json={
                "title": f"Disposable audit probe {uuid.uuid4()}",
                "examcode": None,
                "max_attempt": 0,
                "description": "One-shot audited capacity probe.",
                "duration_minutes": 30,
                "start_time": now.isoformat(),
                "end_time": (now + timedelta(hours=1)).isoformat(),
                "status": "draft",
                "result_visibility": "hidden",
                "subject_id": "LOAD101",
            },
            name="teacher audited exam create",
            catch_response=True,
        ) as response:
            if response.status_code != 201:
                response.failure(f"audited mutation rejected: HTTP {response.status_code}")
            else:
                response.success()


class AdminUser(BaseUser):
    weight = 1

    @task(4)
    def users(self) -> None:
        if self.authenticated:
            self.request("GET", "/api/admin/users?page=1&page_size=20", name="admin users")

    @task(3)
    def permissions(self) -> None:
        if self.authenticated:
            self.request("GET", "/api/admin/teacher-permissions", name="admin permissions")
