# Final Cross-Role 250-User Verification Report

Date: 2026-08-14

## Scope and environment

- Source baseline: `7cf922a` reliability foundation plus `ba3fd18` exam-flow merge on `duchuy_v4`.
- Verification topology: `docker-compose.yml` plus `docker-compose.test.yml`, project `oes-postpull-verify`.
- Services: Nginx, two API instances, MySQL, Redis, RabbitMQ, outbox publisher, and report/import/grading/notification/analytics/anti-cheat workers.
- The database and accounts are disposable `LOAD_*` verification data only.

## Capacity acceptance

| Stage | Requests | Failures | Median | P95 | P99 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 20 | 3,574 | 0 | 9 ms | 17 ms | 40 ms |
| 50 | 8,848 | 0 | 9 ms | 18 ms | 78 ms |
| 100 | 17,588 | 0 | 9 ms | 23 ms | 140 ms |
| 250 | 43,047 | 0 | 10 ms | 64 ms | 740 ms |

Source: `deploy/loadtest/results/postpull_20260814/stage*_stats.csv` and matching zero-row failure/exception CSV files. The workload authenticates Student, Teacher, and Admin users. Student requests exercise start, question read, autosave, anti-cheat event, and submit. Teacher/Admin load traffic uses real authorized read paths; destructive concurrency is covered by focused tests below.

## MySQL and queue metrics

Post-verification MySQL snapshot from the isolated stack:

| Metric | Value |
| --- | ---: |
| Max_used_connections | 73 |
| Threads_connected | 72 |
| Connection_errors_max_connections | 0 |
| Innodb_row_lock_waits | 0 |
| Innodb_row_lock_time | 0 |
| Duplicate non-null submit request ids | 0 |
| Pending outbox events after RabbitMQ recovery | 0 |

Six in-progress attempts remained intentionally after the live Redis/RabbitMQ failure script started disposable Students. They are distinct attempts on distinct disposable devices, not duplicate attempts; the script does not submit or delete test data.

## Business invariants and evidence

| Invariant | Status | Evidence |
| --- | --- | --- |
| No double attempt | PASS | `test_atomic_start_attempt.py`; authenticated load uses one device/session per Student. |
| No stale/lost autosave | PASS | `test_autosave_revisions.py`; stage-250 autosave requests had zero failures. |
| No double submit | PASS | `test_student_exam_flow.py`, `test_essay_finalization.py`, and `test_rabbitmq_outbox.py` validate submit request idempotency and one outbox event. |
| Anti-cheat is backend-enforced | PASS | `test_anti_cheat_events.py`; stage-250 sends bounded authenticated events. |
| Teacher writes have no lost update/partial assignment or pool save | PASS | `test_teacher_exam_optimistic_locking.py`, `test_exam_assignments.py`, `test_exam_pool_features.py`. |
| Admin class/permission writes are atomic and audited | PASS | `test_admin_classes.py`, `test_teacher_exam_subject_permissions.py`; class mutation records audit and required permission analytics outbox event in the same transaction. |
| MySQL is source of truth | PASS | Redis-down business mutations below succeeded while readiness was degraded only for Redis. |
| RabbitMQ is not transaction source of truth | PASS | Rabbit-down business mutations committed and durable outbox event was observed before broker recovery. |
| Multi-instance has no sticky business state | PASS | Nginx returned `/health/live` 200 after isolated `api-1` was stopped; `api-2` remained healthy. |

Focused regression commands executed after the pull:

```text
52 passed: teacher locking, assignment/pool, permission/RBAC, admin classes, imports, observability
62 passed: student flow, autosave, anti-cheat, atomic start, essay finalization, outbox/workers
14 passed: frontend anti-cheat tests
frontend production build: PASS
```

## Redis/RabbitMQ failure injection

Live script: `deploy/loadtest/failure_injection.ps1`.
Evidence: `deploy/loadtest/results/postpull_20260814/failure_injection.json`.

| Failure | Verified operation | Result |
| --- | --- | --- |
| Redis stopped | Student starts attempt | PASS, attempt 259 created |
| Redis stopped | Teacher saves exam settings | PASS, version 8 |
| Redis stopped | Admin replaces teacher permission set | PASS, one active permission |
| Redis stopped | Readiness | PASS, 200 with MySQL/RabbitMQ ready and Redis degraded |
| RabbitMQ stopped | Student starts attempt | PASS, attempt 260 created |
| RabbitMQ stopped | Teacher saves exam settings | PASS, version 9 |
| RabbitMQ stopped | Admin creates report job | PASS, HTTP 202, job 3 |
| RabbitMQ stopped | Durable MySQL outbox | PASS, pending event count was 1 |
| RabbitMQ restarted | Outbox recovery | PASS, pending event count returned to 0 |

The script restores Redis and RabbitMQ in `finally` blocks, and selects idle disposable Students so it does not bypass the application's resume/no-double-attempt rule.

## Operations and schema

- `/health/live`: 200 and preserves a supplied `X-Request-ID`.
- `/health/ready`: 200 with MySQL, Redis, and RabbitMQ ready; optional dependency failure returns degraded while MySQL remains the readiness authority.
- Structured request logging and request-id propagation are covered by `test_observability.py`.
- Alembic repository and configured database are at the single head `e7c5b3a1d902`.
- The class uniqueness migration `uq_class_subject_name` is applied; it prevents duplicate class names within one Subject.

## Acceptance conclusion

The mandatory 20 -> 50 -> 100 -> 250 authenticated capacity gate is PASS. The cross-role correctness, Redis/RabbitMQ recovery, API failover, transaction/locking, idempotency, audit, RBAC, cache invalidation, and schema evidence listed above are PASS for the disposable verification environment. 500 and 1,000 users remain future work.
