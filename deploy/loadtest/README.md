# Authenticated Locust workload

This is the repository's only load-test framework. The default procedure uses
the disposable Compose topology and `backend/scripts/seed_loadtest.py` after
Alembic migration. The seed creates 2 Admins, 5 Teachers, and 500 Students;
every Student virtual user receives a distinct `example.test` account.

For the guarded Railway staging procedure, use
[`RAILWAY_STAGING.md`](RAILWAY_STAGING.md). Railway mode accepts only the
documented staging API domain and requires an explicit acknowledgement before
the disposable workload can write attempts or events.

Use a non-production password only in the current shell (never commit it):

```powershell
$env:LOADTEST_PASSWORD = 'temporary-disposable-password'
$env:OES_TEST_DB_POOL_SIZE = '32'
$env:OES_TEST_DB_SQL_POOL_SIZE = '32'
$env:OES_TEST_DB_SQL_MAX_OVERFLOW = '0'
docker compose -p oes-load -f docker-compose.yml -f docker-compose.test.yml run --rm migrate
docker compose -p oes-load -f docker-compose.yml -f docker-compose.test.yml run --rm -e LOADTEST_PASSWORD api-1 python scripts/seed_loadtest.py
$env:OES_TEST_HTTP_PORT = '18081'
uvx --with locust locust -f deploy/loadtest/locustfile.py --host http://127.0.0.1:18081 --headless -u 20 -r 5 -t 2m
```

The Student, Teacher, and Admin mix is weighted 6:3:1. Student traffic starts
one isolated attempt, reads questions, autosaves, sends one bounded anti-cheat
event, and submits. Teacher and Admin traffic uses non-conflicting real read
paths. The script stops early when the requested account pool is insufficient
and marks all manually classified responses through Locust `catch_response`.
