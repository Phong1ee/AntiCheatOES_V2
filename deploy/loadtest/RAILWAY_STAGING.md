# Railway Staging Load Test

This procedure targets only the public Railway staging API:
`https://anticheatoesv2-staging.up.railway.app`.

## Safety model

- It uses only `LOAD_*` identities and the `LOAD101` disposable subject.
- Student requests create attempts, autosaves, anti-cheat events, and submits
  only for disposable accounts. Teacher draft creation is disabled by default.
- Do not point Railway mode to another host. The Locust guard rejects it.
- Never record `LOADTEST_PASSWORD` in CSV, metadata, logs, or the repository.

## Preflight

Run the read-only verifier in an approved Railway API-service command runner:

```sh
python scripts/verify_railway_loadtest_seed.py --students 150 --teachers 75 --admins 25
```

Run the command from the Railway API service working directory (`/app`). It
must exit with code 0. It checks aggregate disposable-role counts, active
`LOAD101` Teacher permissions, Student assignments, and exactly one disposable
exam.

If it reports that the initial disposable seed is absent, an authorized project
owner must run the existing seed scripts in the API service command runner with
a non-production `LOADTEST_PASSWORD` supplied only for that command:

```sh
python scripts/seed_loadtest.py
python scripts/seed_loadtest_roles_append.py --teacher-last 75 --admin-last 25
```

The first command is valid only when no `LOAD_*` identities exist. The second
expands the initial pool from 5 Teachers and 2 Admins to the 75 Teachers and
25 Admins required by the 6:3:1, 250-user workload. Rerun the verifier before
executing Locust.

## Run stages

Set the disposable account password only in the current PowerShell session,
then run one stage at a time from the repository root:

```powershell
$env:LOADTEST_PASSWORD = 'set-a-non-production-password-here'
.\deploy\loadtest\run_railway_stage.ps1 -Users 1
```

After the one-user smoke test passes, run `25`, `50`, `100`, `150`, `200`, and
`250`. Each run writes a timestamped folder containing Locust CSVs,
`metadata.json`, `health_before.json`, and `health_after.json`.

## Stop conditions

Stop the campaign if a stage records failures, readiness becomes degraded, or
the disposable account preflight fails. Do not start the next stage until the
cause is understood and the previous stage's evidence is retained.
