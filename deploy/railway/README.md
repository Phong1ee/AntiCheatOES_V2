# Railway Deployment

This directory documents a Railway project built from this repository. It does
not contain credentials or a `railway.toml`: the API and each worker need a
different Railway start command, so Dashboard service settings are clearer and
avoid accidentally exposing a worker.

Deploy the frontend to Vercel. Create the Railway services listed in
`SERVICES.md`; only `api` receives a public domain. Use the backend Dockerfile
for `api` and every worker. Keep MySQL, Redis, RabbitMQ, and the S3-compatible
bucket private through Railway private networking/integration variables.

Before each API release, configure its Railway pre-deploy command once:

```sh
python scripts/migrate_deployment.py
```

Only the API deployment runs this command. Workers must never migrate at
startup. `data.sql` is not part of the deployment path; Alembic is the schema
source of truth.

See `ENVIRONMENT_VARIABLES.md` and complete `DEPLOY_CHECKLIST.md` before
attaching a public domain.

## MySQL migrations on deployment

In the Railway **AntiCheatOES_V2 API service**, open Settings > Deploy >
Pre-deploy Command and set `python scripts/migrate_deployment.py`. The backend
Docker image runs in `/app` and already contains Python, Alembic and the frozen
runtime dependencies. Do not add this command to the Docker CMD, FastAPI startup
or worker services. Dashboard configuration is required; editing this repository
alone does not change Railway service settings.

Set `APP_ENV=staging` for staging or `production` for production, and explicitly
configure all five `DB_*` variables listed in `ENVIRONMENT_VARIABLES.md`. The
runner refuses to fall back to a developer `.env` when any required variable is
missing. Use MySQL private-network variable references from Railway; local `.env`
values do not configure Railway.

The runner checks for exactly one repository head, takes a database-scoped MySQL
advisory lock for up to 60 seconds, runs `upgrade head` on that same connection,
and verifies the recorded revision. The lock is released on success/failure or
connection closure. A failed command exits nonzero so Railway stops that release.
Connection timeout is 30 seconds. Database credentials and driver SQL errors are
not printed. Grant the migration account the privileges required by the reviewed
migrations (DDL and applicable data backfills); ordinary application permissions
alone may be insufficient.

Read-only verification inside the API service environment:

```sh
python scripts/migrate_deployment.py --check
python -m alembic -c /app/alembic.ini current
python -m alembic -c /app/alembic.ini heads
```

From a local checkout, with deployment variables explicitly supplied to the
process, use `uv run python scripts/migrate_deployment.py --check` from `backend`.
Do not expose Railway private hostnames to the public Internet just to run this
from a workstation; run it in Railway's private network.

Review pending migrations and take a database backup before releasing schema
changes. MySQL DDL can partially apply before an error: inspect the actual schema
and revision before retrying. Never automatically `stamp head`, reset the
existing database, import `data.sql`, or downgrade on a deployment failure. For a
pre-existing unversioned database, reconcile its schema with migration history
before enabling the upgrade hook. Workers should deploy after the API migration
has succeeded, and schema changes must remain compatible with the still-running
previous release during pre-deploy.
