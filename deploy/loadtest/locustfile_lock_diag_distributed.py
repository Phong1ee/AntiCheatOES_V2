"""The validated capacity workload with only deterministic exam assignment changed."""

import locustfile as base
from locustfile import *  # noqa: F401,F403
from locust.exception import StopUser


def _exam_id_for_student(role: str, email: str) -> int:
    if role != "STUDENT":
        return 1
    # The final local-part segment is the stable zero-padded student sequence.
    student_number = int(email.partition("@")[0].rsplit(".", 1)[-1])
    return ((student_number - 1) % 5) + 1


_base_start_attempt = StudentUser._start_attempt


def _distributed_start_attempt(self) -> None:
    self.exam_id = _exam_id_for_student(self.role, self.email)
    original_request = self.request

    def request_for_assigned_exam(method, path, **kwargs):
        return original_request(method, path.replace("/api/exams/1", f"/api/exams/{self.exam_id}"), **kwargs)

    self.request = request_for_assigned_exam
    _base_start_attempt(self)


_base_on_start = StudentUser.on_start


def _distributed_base_on_start(self) -> None:
    self.role = self.__class__.__name__.replace("User", "").upper()
    self.token = None
    self.authenticated = False
    try:
        self.email, password = base._allocate(self.role)
    except RuntimeError as exc:
        raise StopUser(str(exc)) from exc

    with self.client.post(
        "/api/auth/login",
        json={"email": self.email, "password": password},
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


def _on_start(self) -> None:
    _distributed_base_on_start(self)
    self.device_id = f"load-device-{uuid.uuid4()}"
    self.attempt_id = None
    self.session_token = None
    self.question_id = None
    self.option_id = None
    self.revision = 0
    if self.authenticated:
        _distributed_start_attempt(self)


StudentUser.on_start = _on_start
