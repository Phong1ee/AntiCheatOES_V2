# Object Storage Production Report

## Design

`src.service.object_storage.ObjectStorage` is the private storage boundary for
bulk uploads, staged background imports, and generated reports.

- `OBJECT_STORAGE_BACKEND=local` keeps the existing three filesystem roots and
  Docker Compose shared volumes for development and verification.
- `OBJECT_STORAGE_BACKEND=s3` stores the same opaque object keys in a private
  S3-compatible bucket. API replicas and workers retrieve the same bytes; no
  local path is persisted in the database or RabbitMQ metadata.
- Bulk requests continue to use `BulkDataRequest.stored_file_key` and SHA-256.
  Import jobs use existing `BackgroundJob.result_metadata.source_key` and
  `source_sha256`; report jobs use `artifact_key`. No schema migration is
  required.
- Path-based import parsers receive a temporary file only inside the worker and
  it is removed in `finally`.

## Failure handling

- Uploads are deleted if the owning database transaction fails.
- Failed object upload prevents the job/request transaction from committing.
- Missing objects and checksum mismatch fail the operation without treating
  content as valid.
- Terminal bulk cleanup is best effort after the database state has committed.
- Redelivered workers preserve the existing background-job and processed-event
  idempotency behavior; report retries overwrite the deterministic artifact key.

## Environment

Local/Compose:

```text
OBJECT_STORAGE_BACKEND=local
```

Railway staging/production:

```text
OBJECT_STORAGE_BACKEND=s3
S3_ENDPOINT_URL=<private Railway S3-compatible endpoint>
S3_ACCESS_KEY_ID=<credential>
S3_SECRET_ACCESS_KEY=<credential>
S3_BUCKET=<private bucket>
S3_REGION=us-east-1
```

Credentials are never returned by APIs and are not committed.

## Validation

- No Alembic migration was required: existing object-key and JSON metadata
  fields are sufficient.
- Focused storage/import/report/worker suite: `32 passed`.
