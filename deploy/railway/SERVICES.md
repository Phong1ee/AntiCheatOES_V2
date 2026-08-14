# Railway Services

| Service | Source / command | Public | Notes |
| --- | --- | --- | --- |
| `api` | backend Dockerfile default command | Yes | Set 2 Railway replicas initially; set `UVICORN_WORKERS=2`. Healthcheck: `/health/ready`. |
| `mysql` | Railway MySQL plugin | No | Supply its private host/port/database/user/password to application services. |
| `redis` | Railway Redis plugin | No | Set `REDIS_URL` from its private connection URL. |
| `rabbitmq` | Railway RabbitMQ service/plugin | No | Set `RABBITMQ_URL` from its private connection URL. |
| `outbox-publisher` | `python -m src.service.outbox_publisher` | No | One replica. |
| `worker-report` | `python -m src.service.report_worker` | No | One replica. |
| `worker-import` | `python -m src.service.import_worker` | No | One replica. |
| `worker-grading` | `python -m src.service.grading_worker` | No | One replica. |
| `worker-notification` | `python -m src.service.notification_worker` | No | One replica. |
| `worker-analytics` | `python -m src.service.analytics_worker` | No | One replica. |
| `worker-anti-cheat` | `python -m src.service.anti_cheat_worker` | No | One replica. |
| `storage bucket` | Railway S3-compatible bucket | No | Private; configure `OBJECT_STORAGE_BACKEND=s3`. |

All application services use `backend/Dockerfile`. The API default command is
`uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${UVICORN_WORKERS:-2}`.
Railway injects `PORT`; no API replica count is embedded in application code.
Existing workers consume durable queues and reconnect through their current
consumer implementation after temporary broker outages. Railway sends SIGTERM
on redeploy; do not wrap commands in a shell that swallows it.

Do not create an Nginx Railway service. The Compose Nginx topology remains for
local load/failure verification only.
