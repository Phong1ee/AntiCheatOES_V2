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
uv run alembic upgrade head
```

Only the API deployment runs this command. Workers must never migrate at
startup. `data.sql` is not part of the deployment path; Alembic is the schema
source of truth.

See `ENVIRONMENT_VARIABLES.md` and complete `DEPLOY_CHECKLIST.md` before
attaching a public domain.
