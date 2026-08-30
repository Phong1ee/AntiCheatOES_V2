# Railway Environment Variables

Set these on `api` and every worker unless noted otherwise. Use Railway private
network hostnames/connection variables; never commit actual values.

| Variable | API | Workers | Required production value |
| --- | --- | --- | --- |
| `APP_ENV` | Yes | Yes | `production` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Yes | Yes | Railway MySQL private connection values |
| `SECRET_KEY` | Yes | Yes | Set once as a Railway Shared Variable with value `${{secret(32)}}`, then reference `${{shared.SECRET_KEY}}` in every service. Never paste a literal value per-service; a mismatch crashes that service at boot. |
| `FRONTEND_ORIGIN` | Yes | Yes | Exact Vercel URL, e.g. `https://app.example.com` |
| `UVICORN_WORKERS` | Yes | No | `2` initially |
| `DB_POOL_SIZE`, `DB_POOL_ACQUIRE_TIMEOUT` | Yes | Yes | API `16`/`5`; worker pool setting below |
| `DB_SQL_POOL_SIZE`, `DB_SQL_MAX_OVERFLOW`, `DB_SQL_POOL_TIMEOUT` | Yes | Yes | API `4`/`0`/`10` |
| `WORKER_DB_POOL_SIZE`, `WORKER_DB_SQL_POOL_SIZE`, `WORKER_DB_SQL_MAX_OVERFLOW` | No | Yes | `2`/`2`/`0` |
| `REDIS_URL` | Yes | Yes | Private Railway Redis URL |
| `RABBITMQ_URL`, `RABBITMQ_SOCKET_TIMEOUT`, `RABBITMQ_BLOCKED_TIMEOUT` | Yes | Yes | Private RabbitMQ URL; `1`/`2` initially |
| `OBJECT_STORAGE_BACKEND` | Yes | Yes | `s3` |
| `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` | Yes | Yes | Railway private bucket integration values |
| `LOG_LEVEL` | Yes | Yes | `INFO` |

For multiple browser origins, set `CORS_ALLOWED_ORIGINS` as a comma-separated
list instead of `FRONTEND_ORIGIN`. The production app refuses to start without
an explicit origin. Vercel needs `VITE_API_BASE_URL=https://<api-domain>` at
build time.

## Connection budget

Initial tested topology:

```text
API: 2 replicas x 2 Uvicorn workers x (DB_POOL_SIZE 16 + DB_SQL_POOL_SIZE 4 + DB_SQL_MAX_OVERFLOW 0) = 80
Workers: 7 x (WORKER_DB_POOL_SIZE 2 + WORKER_DB_SQL_POOL_SIZE 2 + DB_SQL_MAX_OVERFLOW 0) = 28
Theoretical application total = 108 connections
```

Leave MySQL headroom for Railway administration and migration. Before changing
replicas/workers/pools, calculate:

```text
api_replicas * uvicorn_workers * (connector_pool + sqlalchemy_pool + sqlalchemy_overflow)
+ worker_replicas_by_type * (worker_connector_pool + worker_sqlalchemy_pool + worker_sqlalchemy_overflow)
```

Keep the result materially below MySQL `max_connections`; never raise pool sizes
independently.
