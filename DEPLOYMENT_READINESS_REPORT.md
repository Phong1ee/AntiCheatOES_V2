# Deployment Readiness Report

Date: 2026-08-14

## Overall status

The source tree is ready for staging after committing the changes listed below.
Production deployment remains blocked until production environment variables and
the managed MySQL connection are supplied and validated in that environment.
No production database was modified.

## P0 - must fix before staging/production

1. Configure Railway (or the container host) with non-empty `DB_HOST`,
   `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and a cryptographically
   random `SECRET_KEY` of at least 32 bytes. `SECRET_KEY` now fails closed when
   missing; the former committed fallback was removed.
2. Run `uv run alembic upgrade head` through the release job against the target
   staging/production database before starting API replicas. Do not use
   `data.sql` or manually alter the schema.
3. Commit the deployment-readiness changes before making a deployment. The
   working tree was clean before this review; the modified/untracked delivery
   set is listed in the "Files to commit" section.

## P1 - should fix before production

1. The local backend `.env` currently cannot authenticate the SQLAlchemy
   connection: `alembic current` returns MySQL 1045 for `root@172.17.0.1`.
   Correct the local/development DB credential or host access rule; the file is
   ignored and was not read or changed by this review.
2. `npm ci` on the host is blocked by a locked
   `node_modules/lightningcss-win32-x64-msvc` binary (`EPERM`). Close the local
   Node/Vite processes that own it and rerun `npm ci && npm test && npm run build`.
   A clean Docker build did run `npm ci` and `npm run build` successfully.
3. Railway/Vercel split hosting needs an explicit same-origin proxy or CORS
   policy. The Compose deployment is same-origin (`/api` via Nginx). For a
   separate Vercel frontend, set `VITE_API_BASE_URL` at build time to the API
   origin and configure backend CORS for that exact Vercel domain.

## P2 - optimize after deployment

1. Vite reports a JavaScript chunk above 500 kB and large ONNX WASM assets.
   Code splitting and lazy-loading anti-cheat assets would improve first load.
2. `deploy/loadtest/results/` CSV files are tracked although future generated
   files are ignored. They are retained as verification evidence; move/archive
   them outside the runtime source repository in a dedicated cleanup task.
3. The full backend suite has existing deprecation warnings for SQLAlchemy
   `declarative_base()` and `datetime.utcnow()`; they do not fail this release.

## Safe fixes applied

- SQLAlchemy URLs now honor `DB_PORT` and safely encode managed-database
  credentials in `backend/database.py`.
- Alembic accepts the SQLAlchemy `URL` object in `backend/alembic/env.py`.
- Authentication refuses to start without `SECRET_KEY`; the placeholder is
  documented in `backend/.env.example`.
- All frontend API callers use `VITE_API_BASE_URL` as an origin. The Compose
  image leaves it empty, so existing `/api/...` calls use the Nginx same-origin
  proxy without producing `/api/api/...` or localhost requests in production.
- The stale migration-head test now expects the actual one-head revision
  `50292736ea8d`.

## Production environment contract

- Frontend development: `VITE_API_BASE_URL=http://localhost:8000`.
- Vercel frontend: set `VITE_API_BASE_URL=https://<production-backend-domain>`
  as a build-time environment variable. `frontend/vercel.json` declares the
  Vite output directory as `build`.
- Railway backend: set `APP_ENV=production`, `FRONTEND_ORIGIN` to the exact
  Vercel domain (or `CORS_ALLOWED_ORIGINS` for a comma-separated list),
  `SECRET_KEY`, and the required database variables. Railway supplies `PORT`;
  the backend Docker command honors it while retaining port 8000 locally.

## Alembic and schema verification

- Repository `uv run alembic heads`: PASS, exactly one head:
  `50292736ea8d`.
- Repository history: PASS. `50292736ea8d` correctly follows `cb1a9d6e4f72`.
- Migration review: PASS. It adds `outcome`, `client_ip`, `user_agent` and the
  three viewer indexes; downgrade reverses them.
- Disposable `oes-e2e` MySQL verification database: PASS. Its
  `alembic_version` is `50292736ea8d`, and all three columns/indexes exist.
- `alembic current` on the configured developer database: FAIL (P1 credential
  access error noted above). No migration was applied there.

## Commands executed

| Command | Result |
| --- | --- |
| `uv sync --frozen` | PASS |
| `uv run alembic heads` / `history` | PASS |
| `docker exec oes-e2e-api-1-1 /opt/venv/bin/alembic current` | PASS (`50292736ea8d`) |
| Focused backend tests | PASS, 7 passed |
| Full backend `pytest` with `PYTHONPATH=.` | PASS, 349 passed, 3 skipped |
| Backend compile/import smoke | PASS |
| `npm ci && npm test && npm run build` on host | FAIL, host file lock during `npm ci` |
| `docker build -t oes-readiness-backend-smoke ./backend` | PASS |
| `docker build -t oes-readiness-frontend-smoke ./frontend` | PASS (includes clean `npm ci` and production build) |
| `docker compose -f docker-compose.yml -f docker-compose.test.yml config --quiet` | PASS; warnings only because production DB variables were intentionally unset |

## Secrets and artifacts

- `.env`, `.env.compose`, `backend/.env`, and `frontend/.env` are ignored and
  are not tracked. Only placeholder example files are tracked.
- No production password, JWT secret, or API credential was found in tracked
  source reviewed here. The test compose credentials are scoped to disposable
  `mysql-test` only.
- No `node_modules`, `.venv`, `build`, `dist`, cache, or Python bytecode is
  tracked. Existing load-test CSV results are intentionally retained evidence.

## Files to commit

- `backend/.env.example`
- `backend/alembic/env.py`
- `backend/database.py`
- `backend/src/middleware/constant.py`
- `backend/tests/test_exam_data_migrations.py`
- `docker-compose.yml`
- `frontend/.env.example`
- `frontend/Dockerfile`
- `frontend/src/components/teacher/TeacherExamList.tsx`
- `frontend/src/components/teacher/TeacherInfoSidebar.tsx`
- `frontend/src/services/api-client.ts`
- `frontend/src/services/api.ts`
- `DEPLOYMENT_READINESS_REPORT.md`
