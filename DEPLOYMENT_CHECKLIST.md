# Deployment Checklist

Use this for each staging or production release. Do not check an item based on
an old local run; record the release date and evidence with the deployment.

## Security And Configuration

- [x] Tracked `.env.example` contains no SMTP/JWT/database credentials; JWT has
  runtime-only fail-fast validation.
- [ ] Revoke the old SMTP/App Password exposed in Git history.
- [ ] Create replacement SMTP credential in the provider.
- [ ] Store the replacement only in the deployment secret manager.
- [ ] Confirm the old SMTP credential no longer works and send a staging test email.
- [ ] Production environment variables configured: `APP_ENV=production`, DB,
  Redis, RabbitMQ, object storage, exact CORS origin, and `LOG_LEVEL`.
- [ ] A new random `SECRET_KEY` of at least 32 characters is stored in the
  platform secret manager and shared by API/workers only.
- [ ] SMTP credentials are secret-manager values, never `.env.example` or Git.
- [ ] MySQL, Redis, RabbitMQ, and S3-compatible bucket are private/reachable.
- [ ] HTTPS/domain and external TLS termination configured.
- [ ] RabbitMQ management port is not publicly exposed.

## Database And Services

- [ ] Backup/snapshot and restore owner confirmed before migration.
- [ ] `cd backend; uv run alembic heads` shows only `50292736ea8d`.
- [ ] `cd backend; uv run alembic upgrade head` succeeds against target DB.
- [ ] `cd backend; uv run alembic current` confirms `50292736ea8d`.
- [x] Disposable Compose migration image upgrades a fresh MySQL database to
  `50292736ea8d` and reports the same current revision.
- [ ] API, outbox publisher, and all configured workers are running.
- [ ] DB connection budget is below MySQL capacity, including replica/worker
  pools and operational headroom.
- [ ] Object storage uses `OBJECT_STORAGE_BACKEND=s3` outside development.

## Validation Before Traffic

- [x] Frontend production build passes; static AI assets are present in `build`.
- [ ] Backend full CI suite passes (including current security configuration
  tests).
- [x] Focused concurrency tests pass for start, autosave, submit, anti-cheat, Teacher
  optimistic locking, and worker redelivery.
- [ ] `/health/live` returns 200.
- [ ] `/health/ready` returns 200 with MySQL ready; record any optional
  Redis/RabbitMQ degradation.
- [ ] Browser production build loads camera model, microphone VAD/ONNX/WASM,
  and anti-cheat worker assets from final HTTPS paths.
- [ ] Audit log records an authorized Teacher/Admin mutation with request ID.
- [ ] Login, start, autosave, submit, resume, and anti-cheat flows work through
  the public reverse proxy.

## Capacity And Failure Evidence

- [ ] Run 20, 50, 100, and 250-user Locust stages using disposable data.
- [ ] Record request count, success/error rate, P50/P95/P99, throughput, DB
  connections, CPU/memory, timeouts, and lock waits.
- [ ] Verify post-test attempts, answers, submissions, outbox rows, and
  anti-cheat counters for duplicates/loss.
- [ ] Run `deploy/loadtest/failure_injection.ps1` on the disposable topology.
- [ ] Verify Redis outage preserves MySQL-backed correctness.
- [ ] Verify RabbitMQ outage leaves durable outbox rows and recovery drains them.
- [ ] Verify an API replica can fail while the remaining replica serves traffic.

## Release And Rollback

- [ ] Deploy migration before application replicas.
- [ ] Deploy API, then verify health checks, then workers, then frontend.
- [ ] Monitor request errors, DB saturation, outbox backlog, worker failures,
  and readiness for the initial release window.
- [ ] Keep the prior image/version available for rollback.
- [ ] If application rollback is required after a migration, use a reviewed
  forward-compatible migration plan; do not run destructive schema rollback
  against production data without a backup and approval.
- [ ] Record deployed commit, migration revision, environment change ticket,
  capacity evidence, and rollback decision.
