# Audit Log Capacity 250 Verification Report

Date: 2026-08-14

## Status: PASS

## Scope and topology

- Reused `deploy/loadtest/locustfile.py` against disposable Compose project `oes-e2e`.
- Topology: Nginx, two API instances, MySQL, Redis, RabbitMQ, outbox publisher, and import worker.
- Audit Log was not disabled or mocked by the load command.
- The existing mixed workload includes one process-wide, non-conflicting Teacher draft-exam creation. It uses the real `POST /api/teacher/add_exam` mutation and its normal transaction-bound `EXAM_CREATED` audit.

## 250-user result

| Metric | Result |
| --- | --- |
| Authenticated users | 250 |
| Duration | 2 minutes |
| Requests | 40,879 |
| Failures | 0 |
| Median / P95 / P99 | 10 ms / 100 ms / 390 ms |
| Baseline requests / failures / P95 | 43,047 / 0 / 64 ms |

## Blocking audit evidence

- `audit_log` rows before and after: `0 -> 1`.
- The inserted row is `EXAM_CREATED` by `LOAD_TEACHER_005` for disposable exam `2`; it has request ID `26ca9cdf-a8ae-46a6-bff3-88bd20d7b142` and safe metadata only.
- No anti-cheat telemetry rows were created.
- Admin Audit Log list, `action=EXAM_CREATED` filter, stats, and detail all returned the expected row after load.

## MySQL and health observations

- `/health/ready`: ready; MySQL, Redis, and RabbitMQ ready.
- `Connection_errors_max_connections`: 0.
- `Max_used_connections`: 82.
- `Innodb_row_lock_waits`: 929; `Innodb_row_lock_time`: 130,511 ms (cumulative stack counters; Locust had zero failures and the audited mutation committed once).

## Conclusion

The rebuilt system passes the 250-user Audit Log capacity regression: 40,879 requests, zero failures, median 10 ms, P95 100 ms, and P99 390 ms. Audit growth was one expected business row, not anti-cheat telemetry, and the Admin Audit viewer remained functional. No schema or infrastructure changes were required.
