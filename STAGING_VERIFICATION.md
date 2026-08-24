# Staging Verification Runbook

Run this against a disposable or backed-up staging environment. Record the
deployed commit, Alembic revision, request IDs, and result of every step.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Configure deployment secrets and explicit CORS origin. | API starts without logging any secret. |
| 2 | Configure private MySQL connection. | DB credentials are accepted; no localhost/default fallback. |
| 3 | Create and verify a DB backup/snapshot. | Restore owner and rollback path are recorded. |
| 4 | Run `cd backend; uv run alembic upgrade head`. | Command succeeds without destructive manual SQL. |
| 5 | Run `uv run alembic current`. | Revision is `50292736ea8d` (or current repository head). |
| 6 | Start Redis. | `PING` succeeds. |
| 7 | Start RabbitMQ and outbox publisher. | Broker health and publisher connection are healthy. |
| 8 | Start each worker. | Report/import/grading/notification/analytics/anti-cheat workers consume their queues. |
| 9 | Start both API replicas behind Nginx. | Both replicas report live and traffic is routable. |
| 10 | Deploy frontend. | `VITE_API_BASE_URL` points only to the HTTPS API origin. |
| 11 | Request `/health/live`. | HTTP 200 proves process liveness. |
| 12 | Request `/health/ready`. | HTTP 200 with MySQL ready; optional dependency degradation is explicit. |
| 13 | Log in as Student. | Valid login succeeds; repeated invalid attempts receive 429 at configured quota. |
| 14 | Start an anti-cheat exam. | Exactly one active attempt and bound session/device. |
| 15 | Save answers, including a retry/stale revision. | Newest revision remains persisted. |
| 16 | Refresh/reconnect and resume. | Existing attempt resumes; refresh event is not duplicated. |
| 17 | Trigger browser anti-cheat event. | Backend count/warning is returned once per client event ID. |
| 18 | Test camera model. | YuNet model loads and model failure degrades without blocking exam flow. |
| 19 | Test microphone with alternating and overlapping voices. | Only conservative multiple-voice violation logic is emitted. |
| 20 | Submit an exam twice/retry. | One logical submission, one outbox business event. |
| 21 | Grade as Teacher and check result visibility. | Authorized workflow updates the correct Student result only. |
| 22 | Perform authorized Admin operation. | Mutation is authorized and creates a sanitized audit log row. |
| 23 | Upload/import a permitted file. | Type/ownership validation works; worker completes once. |
| 24 | Send a staging password-reset email. | New secret-manager SMTP credential works; no credential appears in logs. |
| 25 | Run 50/100/250 Locust stages and failure injection. | HTTP metrics and post-load DB integrity meet existing acceptance evidence. |

## Mandatory Failure Checks

- Stop Redis: login/password recovery returns controlled 503; exam start,
  autosave, and submit remain MySQL-correct.
- Stop RabbitMQ during a DB mutation: durable outbox row remains pending, then
  drains after recovery.
- Stop one API replica under traffic: the remaining replica serves requests and
  no attempt/answer is lost.
- Stop one worker during a job: redelivery does not duplicate the business
  effect due to `processed_event` idempotency.

## Browser Asset Check

Open the actual final HTTPS frontend and verify network responses for:

- `/models/camera/face_detection_yunet_2023mar.onnx`
- `/models/audio/pyannote-segmentation-3.0-int8.onnx`
- `/vad/silero_vad_v5.onnx` and `/vad/vad.worklet.bundle.min.js`
- emitted `ort-wasm-simd-threaded*.wasm` assets and overlap worker bundle

All must return successfully without localhost paths, mixed content, or MIME
errors. This is a runtime browser gate; build presence alone is insufficient.
