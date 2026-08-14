# Railway Deploy Checklist

1. Create private MySQL, Redis, RabbitMQ, and S3-compatible bucket resources.
2. Create the API and seven worker services from this GitHub repository using
   the backend Dockerfile and commands in `SERVICES.md`.
3. Copy the required variables from `ENVIRONMENT_VARIABLES.md` to API/workers;
   use private service networking values and set `OBJECT_STORAGE_BACKEND=s3`.
4. Set the API pre-deploy command to `uv run alembic upgrade head`; do not set
   it on workers.
5. Set API healthcheck path to `/health/ready`, deploy API first, and verify
   `/health/live` plus `/health/ready` through its public domain.
6. Set Vercel `VITE_API_BASE_URL` to that exact API HTTPS domain, then set
   Railway `FRONTEND_ORIGIN` to the exact Vercel HTTPS domain.
7. Start workers, verify RabbitMQ queue consumption and object-storage-backed
   bulk upload/report download, then scale API to two replicas.
8. Confirm database connection budget remains below MySQL capacity after every
   scaling or pool change.

No schema migration is required for this Railway configuration itself.
