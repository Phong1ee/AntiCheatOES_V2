# Question page pins and media upload fixes

Implemented on camera_retinaface_eval in D:/School/SUPER_FINAL/AntiCheatOES_V2.

## Behavior

- Parent blocks contain shared rich/media stimulus and independently scored children. Groups organize existing questions with optional instructions.
- Explicit pinned_page is separate from legacy pinned_position. Questions and logical blocks pinned to the same page receive distinct slots on that page. A pinned page can expand beyond the default questions_per_page, up to 50 answers.
- Unpinned pages use questions_per_page (1-50). Free blocks shuffle deterministically; pinned pages retain their placement. Empty pages and impossible block placements produce explicit conflicts.
- Teacher group modal exposes Pin to page and Questions per page. Teacher preview and student rendering use the same snapshotted page layout.
- Axios clears its JSON Content-Type default for FormData so the browser can supply a multipart boundary. Uploads preserve authentication, allow 60 seconds, retain the draft on failure and show an error.
- Existing attempt snapshots are not modified. New attempts snapshot the final shared-page layout.

## Migration

backend/alembic/versions/c7e51a9b2046_add_question_page_pins.py follows 8a21c7e5b940. It adds nullable pinned_page to exam_question and exam_question_block and backfills existing global pins to their page. The old pins are cleared in current exam structure only.

Ran Alembic current, heads and history before creating the migration; reviewed upgrade/downgrade; then heads, upgrade head and current. Configured project MySQL reports c7e51a9b2046 (head), one repository head; both columns were inspected. This does not verify Railway MySQL.

Downgrade deliberately fails because shared-page pins cannot be losslessly converted to unique global slots. Use a reviewed forward migration to reverse this feature.

Railway API must run `uv run python scripts/migrate_deployment.py` as its pre-deploy command with APP_ENV=staging or production and service DB variables. Do not deploy new backend code against a database without the new columns.

## Executed verification

- `uv run pytest tests/test_question_multimedia_structure.py tests/test_student_exam_flow.py tests/test_deployment_migrations.py tests/test_exam_settings_questions_per_page.py -q --tb=short`: 106 passed.
- `uv run pytest -q --tb=short`: 576 passed, 4 failed, 4 skipped, 14 subtests passed. This run began before the final added snapshot test; that test passed in the focused run above.
- Existing failures: MySQL pool fixture omits charset/collation; JWT secret configuration affected by the existing local constant.py edit; two Teacher integration tests conflict with existing active-attempt locking. These are the same failures recorded before this change.
- `npm test`: 72 passed in 11 files, including real FormData serialization, image/audio editor upload, draft retention, shared-page pin payload, preview page pins and legacy pagination.
- Backend tests send real multipart ASGI requests containing valid PNG and WAV bytes and verify persisted bytes.
- `npm run build`: passed (2584 modules); existing large-chunk warning.
- `npm run typecheck`: fails with the same 14 pre-existing errors in camera/audio anti-cheat, admin and unrelated Teacher files; none in changed files.
- `git diff --check`: passed after line-ending cleanup.

No .env, dependencies, built assets, sample media or unrelated local constant.py changes are included. Authenticated manual browser verification on Railway is still needed; deployment requires confirming the API pre-deploy migration first.
