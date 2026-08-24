# Production Readiness Audit

Date: 2026-08-24

## Verdict

**READY WITH DEPLOYMENT PREREQUISITES**

The code has durable MySQL-backed state, transactional exam mutations,
idempotency controls, an outbox, worker deduplication, and two-API Compose
topology. This audit fixed the committed JWT default and SMTP credential
exposure. Deployment remains conditional on secret rotation, a target-database
migration, and the external production checks listed below.

## Evidence Matrix

| Area | Status | Evidence | Issue / fix |
| --- | --- | --- | --- |
| Student attempt | PASS | `backend/src/models/teacher/examModel.py`; `tests/test_atomic_start_attempt.py` | Assignment, exam, and active-attempt rows are locked before creation. Focused regression passed. |
| Autosave | PASS | `examModel.py`; `tests/test_autosave_revisions.py` | Per-answer revision plus `FOR UPDATE` rejects stale/retried writes. |
| Submit | PASS | `examModel.py`; `tests/test_student_exam_flow.py`, `tests/test_essay_finalization.py` | Attempt row lock, terminal-state validation, request idempotency, and transactional outbox prevent duplicate logical submissions. |
| Anti-cheat | PASS | `examModel.py`; `tests/test_anti_cheat_events.py` | Client-event id deduplication and locked violation counter ensure one termination transition. Client model errors remain non-blocking. |
| Teacher/Admin writes | PASS | `src/service/exam_version_service.py`; `tests/test_teacher_exam_optimistic_locking.py`, `tests/test_teacher_exam_subject_permissions.py`, `tests/test_admin_classes.py` | Ownership/scope checks, transactions, and optimistic version claims protect writes. |
| MySQL / schema | PARTIAL | `database.py`; `backend/alembic`; `uv run alembic heads` | One repository head `50292736ea8d`; configured developer DB rejected connection with MySQL 1045, so target DB state is not verified. |
| Redis | PASS (design/test) | `src/service/cache_service.py`; `tests/test_observability.py`; existing failure report | Cache-aside is fail-open; MySQL retains canonical state. Re-run failure injection per deployment. |
| RabbitMQ / workers | PASS (design/test) | `src/service/outbox_publisher.py`, `src/service/rabbitmq_worker.py`; worker/outbox tests | MySQL outbox persists before publication; processed-event marker handles redelivery. |
| Multi-instance API | PARTIAL | `docker-compose.yml`, `deploy/nginx/nginx.conf`; existing 250-user report | Two API instances and shared stores exist; this audit did not start a disposable Compose stack. |
| RBAC / audit log | PASS | route ownership checks; `src/service/audit_service.py`; focused tests | Actor comes from authenticated identity and audit context is sanitized. |
| File handling | PASS (design/test) | `src/service/object_storage.py`; `tests/test_object_storage.py` | Production must use private S3-compatible storage; local volumes are development/Compose only. |
| Security / secrets | PARTIAL | `src/middleware/constant.py`; `src/service/email_service.py`; `tests/test_security_configuration.py` | Fixed hard-coded JWT secret and removed SMTP credentials/template fallback. The previously committed SMTP credential must be revoked/rotated. |
| Rate limiting | PARTIAL | `src/service/rate_limit_service.py`, `passwordResetRoute.py` | Password reset is limited, but the current limiter is process-local and login/exam abuse limits are not globally enforced. |
| Observability | PASS | `main.py`; `ObservabilityMiddleware`; `tests/test_observability.py` | Structured request IDs, sanitized logs, liveness and MySQL-authoritative readiness exist. |
| Docker / deployment | PARTIAL | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` | Compose parses with supplied values; runtime Compose/build and graceful shutdown were not rerun in this audit. |
| Migrations | PARTIAL | `backend/alembic/versions`; Alembic history | Migration chain has one head; `current` / `upgrade head` require a reachable target database. |
| Concurrency tests | PASS | Focused command below | 105 focused tests passed, including start, autosave, submit, anti-cheat, worker and Teacher locking paths. |
| Capacity 250 | PARTIAL | `FINAL_CROSS_ROLE_250_VERIFICATION_REPORT.md` | Existing disposable-stack evidence reports 43,047 requests, zero failures, P95 64 ms; not rerun in this audit. |
| Failure recovery | PARTIAL | `deploy/loadtest/failure_injection.ps1`; existing report | Existing evidence covers Redis/RabbitMQ recovery and API failover; not rerun here. |
| Production build | PASS | `frontend` `npm run build` | Passed on 2026-08-24; Vite reports large chunks only. |

## Changes Applied

- `backend/src/middleware/constant.py` now fails startup unless `SECRET_KEY` is
  non-placeholder and at least 32 characters; no JWT fallback remains.
- `backend/.env.example` no longer contains SMTP credentials.
- `backend/src/service/email_service.py` reads SMTP configuration only from the
  runtime environment, never from the committed template.
- `backend/tests/test_security_configuration.py` proves the secret fail-fast
  policy and clean SMTP template.

No schema change was required, so no migration was created or applied.

## Commands And Results

| Command | Result |
| --- | --- |
| `cd backend; $env:SECRET_KEY=...; $env:PYTHONPATH='.'; uv run pytest tests/test_security_configuration.py tests/test_auth_session_lifetime.py tests/test_password_reset_service.py` | PASS: 26 passed. |
| `cd backend; $env:SECRET_KEY=...; $env:PYTHONPATH='.'; uv run pytest` (focused hot-path selection) | PASS: 105 passed. |
| `cd backend; $env:SECRET_KEY=...; uv run alembic heads` | PASS: one head, `50292736ea8d`. |
| `cd backend; $env:SECRET_KEY=...; uv run alembic history --verbose` | PASS: linear active chain ending at `50292736ea8d`. |
| `cd backend; $env:SECRET_KEY=...; uv run alembic current` | NOT VERIFIED: MySQL 1045 for configured developer credentials. No schema was changed. |
| `cd frontend; npm run build` | PASS: production build completed in 12.65 s; large-chunk warning only. |
| `docker compose -f docker-compose.yml -f docker-compose.test.yml config --quiet` | PARTIAL: configuration parsed, with expected warnings because production DB/secret variables were intentionally unset. |
| Full `uv run pytest -q` | NOT VERIFIED as one command: terminal execution limit ended before a final result. Focused coverage above passed. |

## Blockers And Follow-up

### P0 - required before public deployment

- Revoke and rotate the SMTP app password that was present in Git history; treat
  it as compromised. Store the replacement only in the deployment secret store.
- Set a random 32+ character `SECRET_KEY`, database credentials, CORS origin,
  Redis/RabbitMQ URLs, and S3 credentials in the target environment.
- On a backed-up staging/production MySQL instance, run `uv run alembic upgrade
  head`, then `uv run alembic current`; verify `50292736ea8d` before API
  replicas receive traffic.

### P1 - complete before broad real-user rollout

- Replace the process-local password-reset limiter with a shared Redis-backed
  policy and add appropriately scoped limits for login/upload/admin mutation
  endpoints. Do not rate-limit autosave/submit in a way that loses valid work.
- Re-run `deploy/loadtest/failure_injection.ps1` and the 20/50/100/250 Locust
  gates in the target-like Compose environment; verify database invariants, not
  only HTTP status.
- Run the complete backend suite in CI without the local terminal time limit.
- Split/lazy-load the >500 kB frontend bundle and validate model/WASM assets at
  the final HTTPS origin.

### P2 - operational hardening

- Add image non-root execution after validating mounted-volume ownership.
- Add graceful shutdown timing checks for API and each worker.
- Define backup restore drills and alert thresholds for DB connections, outbox
  backlog, dead-letter traffic, and readiness degradation.

## Production Requirements

- Use private MySQL, Redis, RabbitMQ, and S3-compatible object storage; MySQL
  remains the source of truth and Redis is cache only.
- Keep the initial 2 API x 2 Uvicorn-worker pool budget at 108 application
  connections as documented in `deploy/railway/ENVIRONMENT_VARIABLES.md`, with
  headroom below MySQL `max_connections`.
- Terminate TLS at the external load balancer/domain and set exact production
  CORS origins. Do not expose RabbitMQ management publicly.
- Follow `DEPLOYMENT_CHECKLIST.md` for the release and rollback sequence.

## Final Remediation / Re-verification

| Area | Previous | Current | Evidence | Remaining action |
| --- | --- | --- | --- | --- |
| SMTP secret | P0 | PARTIAL | Current tracked source/template scan is clean; `email_service.py` reads runtime env only. | **REQUIRES MANUAL EXTERNAL ACTION:** revoke old App Password, create replacement, store only in secret manager, confirm old credential fails. |
| JWT | P0 | PASS | `constant.py`; `test_security_configuration.py`. | Set real secret in deployment platform. |
| Production DB config | PARTIAL | PASS (code) | `database.py` fails fast for missing production DB settings; security test passes. | Target credentials and DB remain external. |
| Alembic | NOT VERIFIED | PASS (disposable Compose) | Fixed masked-password URL bug in `alembic/env.py`; rebuilt migration image ran `upgrade head`, then `current` returned `50292736ea8d`. | Run the same sequence on backed-up target MySQL. |
| Full backend tests | NOT VERIFIED | PARTIAL | Completed batches: 75 + 66 + 124 (3 intentional E2E skips) + 63 + 31 passed. | One Teacher Question Bank batch exceeded local terminal limit; CI now runs `uv run pytest` unconditionally. |
| Distributed rate limiting | P1 | PASS (code/test) | Redis Lua `INCR` + TTL, hashed keys, configurable Compose/env values; `test_rate_limit_service.py`. | Monitor Redis availability; auth intentionally fails closed with 503. |
| Concurrency | Old PASS | PASS | `test_atomic_start_attempt.py`, `test_autosave_revisions.py`, `test_anti_cheat_events.py`, worker and Teacher locking tests in passed batches. | Re-run against target-like MySQL before public launch. |
| Capacity 250 | Old evidence | PARTIAL | `FINAL_CROSS_ROLE_250_VERIFICATION_REPORT.md` records 43,047 requests, zero failures, P95 64 ms. | Re-run 50/100/250 Locust suite on current release topology. |
| Redis/RabbitMQ recovery | Old evidence | PARTIAL | Existing failure-injection report and unit regressions. | Run `deploy/loadtest/failure_injection.ps1` in disposable Compose environment. |
| Multi-instance | Old evidence | PARTIAL | Two API Compose services and Nginx upstream remain configured. | Run live API-A failure check. |
| Frontend build / AI assets | PASS | PASS (static) | `npm run build`; current build contains camera, VAD, audio ONNX, worker/WASM assets. | Browser runtime test at final HTTPS origin. |
| Docker non-root | P2 | P2 | Backend image writes to named artifact volumes owned by runtime. | Adopt non-root only with verified volume ownership/drop-privilege entrypoint. |

### Rate-limit Failure Policy

- Login, forgot-password, OTP verification, and password-reset use Redis shared
  counters with atomic TTL. Redis failure returns HTTP 503 before sensitive
  authentication work (fail closed).
- Student start, autosave, submit, resume, and anti-cheat paths do not call the
  limiter. Their correctness continues through MySQL while Redis is unavailable.
- Rate-limit keys contain a SHA-256 digest of the IP/email subject, not the raw
  identifier, and expire automatically.
