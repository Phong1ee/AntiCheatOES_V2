# Camera, Microphone, and Audio Proctoring Test Report

Date: 2026-08-06

## Scope and Result Rules

- PASS means the listed automated command or assertion completed successfully.
- MANUAL_REQUIRED means a real browser session, enrolled student attempt, and physical camera/microphone test are still required. It is not a PASS.
- No test in this report claims perfect detection accuracy or identifies a speaker, a person's identity, or cheating intent.

## Automated Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Active Alembic revision | PASS | `f3b8d2a7c5e1 (head)` |
| Alembic heads | PASS | Exactly one head: `f3b8d2a7c5e1` |
| Focused anti-cheat events | PASS | `uv run python -m pytest tests/test_anti_cheat_events.py -q`: 8 passed |
| Full backend suite | PASS | `uv run python -m pytest -q`: 169 passed, 14 subtests passed |
| Frontend production build | PASS | `npm run build`: Vite build completed |
| Lint/typecheck | BLOCKED | `package.json` defines only `dev` and `build`; no lint or typecheck script exists |
| Local model checksum audit | PASS | All four model SHA-256 values match `frontend/public/models/anti-cheat/MODEL_MANIFEST.md` |

The backend test commands emit existing SQLAlchemy deprecation warnings. The frontend build emits Vite's existing warning that the main JavaScript chunk is larger than 500 kB after minification; the build still succeeds.

## Test Matrix

| Area | Result | Notes |
| --- | --- | --- |
| Preflight granted and denied | MANUAL_REQUIRED | Test direct permission prompt for both grant and deny before attempt creation. |
| Resume permission denied | MANUAL_REQUIRED | Verify exactly one recovery incident on denial for an active attempt. |
| Camera muted, ended, and unplugged | MANUAL_REQUIRED | Verify 3-second mute rule, one incident family, recovery overlay, and 30-second cooldown. |
| Microphone muted, ended, and unplugged | MANUAL_REQUIRED | Verify independent microphone family and that camera incidents do not suppress it. |
| Recovery preserves attempt and answers | MANUAL_REQUIRED | Enter an answer, force media loss, restore both tracks, then verify answer and attempt ID remain unchanged. |
| No face, low quality, invalid position, missing shoulders, multiple faces | MANUAL_REQUIRED | Requires controlled camera framing, lighting, and another person for multiple-face validation. |
| Phone detection | MANUAL_REQUIRED | Requires a verified visible phone at several distances and non-phone controls. |
| Gaze, head pose, repeated head movement | MANUAL_REQUIRED | Review-only flags; verify no violation count increment. |
| Quiet room, fan, keyboard click, sustained sound | MANUAL_REQUIRED | Validate five-second calibration and activity threshold without recording audio. |
| Sustained speech and below-threshold speech | MANUAL_REQUIRED | Verify YAMNet `Speech` confidence, 4/5 windows, five-second sustain, recovery, and cooldown. |
| Signal degraded | MANUAL_REQUIRED | Verify clipping/noise condition with a controlled input; do not route microphone to speakers. |
| Duplicate `clientEventId` | PASS | Focused backend test verifies idempotency. |
| Counted versus review-only | PASS | Focused backend test verifies Speech is automated/review-only and does not increment the counter. |
| Termination at shared global limit | PASS | Focused backend test verifies one termination event and score 0.00. |
| Teacher timeline and breakdown | PASS | Focused backend test verifies policy classification; route breakdown queries only `is_violation=1`. |
| Cleanup after submit, termination, timeout, refresh/resume | MANUAL_REQUIRED | Perform browser DevTools/media-track verification after each exit path. |

## Model and Runtime Inventory

| Asset | Size | SHA-256 | Verified capability |
| --- | ---: | --- | --- |
| `face_landmarker.task` | 3,758,596 bytes | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` | Face landmarks and presence |
| `pose_landmarker_lite.task` | 5,777,746 bytes | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` | Pose landmarks and shoulders |
| `efficientdet_lite0.tflite` | 13,836,895 bytes | `40338edf5ec70d43e318b0a716a84d4564cd1802759a7a07170c7e43796dbf58` | COCO `cell phone` category |
| `yamnet.tflite` | 2,371,584 bytes | `39b436ad09513e7ca83a96fd90d6bc083a5d8548fa5d1fae39b1685555f6b7f6` | AudioSet `Speech` category |

- Total model size: 25,744,821 bytes (24.55 MiB).
- Local MediaPipe WASM/runtime size: 55,800,394 bytes (53.22 MiB).
- Total local proctoring assets: 81,545,215 bytes (77.77 MiB).
- Versions and official sources are recorded in `frontend/public/models/anti-cheat/MODEL_MANIFEST.md`.

## Benchmark

| Measure | Result | Notes |
| --- | --- | --- |
| Face/pose scheduling | PASS (configured) | Target 5 FPS; 200 ms interval. |
| Object scheduling | PASS (configured) | Target 2 FPS; 500 ms interval. |
| Audio scheduling | PASS (configured) | Five-second calibration; one-second analysis/classification cadence; transient 980 ms classifier window. |
| Model load time | MANUAL_REQUIRED | Measure separately for first and cached loads on the target browser/device. |
| Average and p95 inference time | MANUAL_REQUIRED | Instrument a real target browser; this report does not estimate values. |
| Browser, device, camera resolution | MANUAL_REQUIRED | `getUserMedia({ video: true, audio: true })` leaves resolution device/browser selected. Record actual settings during the test. |
| CPU and memory | MANUAL_REQUIRED | Record browser task-manager or performance-panel observations during a 10-minute attempt. |
| UI responsiveness | MANUAL_REQUIRED | Verify timer, navigation, answer typing, drag preview, and recovery overlay under all enabled detectors. |
| False positives and false negatives | MANUAL_REQUIRED | Use repeated controlled sessions; detector results are observations, not proof. |

## Manual Execution Notes

Use a disposable anti-cheat-enabled exam and a student account. Record browser version, operating system, CPU, available memory, camera resolution, lighting, noise source, model-load times, inference samples, and observed event IDs. For each flag, confirm the backend response fields `automatedFlag` and `countsTowardLimit`, the persisted `is_violation` value, and the Teacher timeline classification. Stop tracks and close workers after every run.
