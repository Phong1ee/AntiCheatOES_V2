# Proctoring Optimization Regression Report

Date: 2026-08-06

## Result summary

| Area | Status | Evidence |
| --- | --- | --- |
| Frontend production build | PASS | `npm run build` completed |
| Focused anti-cheat backend tests | PASS | 8 passed |
| Full backend suite | PASS | 169 passed, 14 subtests passed |
| Alembic current revision | BLOCKED | Database reports missing `ccd8210b8297` |
| Alembic repository head | PASS | `f3b8d2a7c5e1` is the one repository head |
| Camera/audio hardware tests | MANUAL_REQUIRED | No physical browser/device session in this run |

## Before / after comparison

| Metric | Before | After | Change |
| --- | --- | --- | --- |
| Face average latency | NOT_MEASURED | NOT_MEASURED | MANUAL_REQUIRED |
| Face p95 latency | NOT_MEASURED | NOT_MEASURED | MANUAL_REQUIRED |
| Pose average latency | NOT_MEASURED | NOT_MEASURED | MANUAL_REQUIRED |
| Object average latency | NOT_MEASURED | NOT_MEASURED | MANUAL_REQUIRED |
| Speech event delay | N/M plus second sustained duration | Single 4-second state machine after N/M | Design improvement; hardware latency NOT_MEASURED |
| Dropped face samples | Shared vision in-flight could drop all detectors | Detector-local in-flight/drop metrics | Architecture improvement; count NOT_MEASURED |
| False-positive scenarios | NOT_MEASURED | Phone box/confidence/sample evidence; audio median baseline | MANUAL_REQUIRED |
| Model load time | NOT_MEASURED | NOT_MEASURED | MANUAL_REQUIRED |
| Vision scheduling | Sequential worker | Independent face/pose/phone workers | PASS by code inspection/build |
| Audio capture | 1-second discrete polling | Continuous PCM, 50% overlap, bounded request | PASS by code inspection/build |

## Test matrix

Camera scenarios (no face short/sustained, one/two faces, small/off-center,
low/backlight/blur, shoulders, head pose, calibrated gaze, movement, near/far
phone, rectangle, mute/ended/recovery): **MANUAL_REQUIRED**.

Audio scenarios (quiet/fan/keyboard/click, short/sustained/whisper speech,
clipping, near-zero, mute/ended/recovery, slow worker/stale result):
**MANUAL_REQUIRED**.

System scenarios (worker isolation, bounded queues, duplicate incident,
counted vs review-only, global limit, score-zero termination, timeline,
cleanup, refresh/resume): focused and full backend event policy coverage is
PASS; real browser lifecycle verification remains MANUAL_REQUIRED.

## Remaining risks and recommendation

- Device/browser: not measured in this execution; run Chrome/Edge/Firefox on
  low/mid/high hardware with `VITE_PROCTORING_DEBUG_METRICS=true`.
- Remaining false positives and detector p95 are unknown without labelled
  real-device runs. Do not claim 100% accuracy.
- Do not change to/custom-train a model yet. `PROCTORING_MODEL_COMPARISON.md`
  remains BLOCKED until comparable load, average/p95, CPU/memory, recall, and
  false-positive evidence shows an improvement.
- Resolve the configured database's missing Alembic revision before any schema
  migration or schema-state claim. No migration was created or applied here.
