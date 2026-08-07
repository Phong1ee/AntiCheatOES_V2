# Proctoring Runtime Fix Report

Generated: 2026-08-06

## Scope and Root Causes

The original face worker created `FaceDetector` and `FaceLandmarker` in one
module worker. MediaPipe's loader factory can be consumed by the first task,
leaving the second task without a factory. The implementation now isolates each
vision task in its own worker. The follow-up diagnostics exposed a second
loader defect: application code pre-imported the package's ESM WASM loader and
assigned its factory to worker global state. Tasks 1.0.1 already imports and
consumes that loader internally; the duplicate preload left later initialization
without the expected factory. The preload and the failed classic-worker proof
were removed from the active path.

Audio initialization previously supplied a URL through `modelAssetPath`.
`loadAndVerifyModelAsset()` now verifies the local YAMNet HTTP response, size,
SHA-256, and `TFL3` magic before passing an in-memory `Uint8Array` through
`modelAssetBuffer`. This distinguishes asset routing/corruption from a package
compatibility failure. The original local YAMNet file was stale: although its
own checksum and `TFL3` header matched the old manifest, it differed from the
official v1 URL and was rejected by `@mediapipe/tasks-audio@1.0.1`.

## Files Changed

- `frontend/src/workers/face-detector.worker.ts`
- `frontend/src/workers/face-landmarker.worker.ts`
- `frontend/src/workers/pose-proctor.worker.ts`
- `frontend/src/workers/object-proctor.worker.ts`
- `frontend/src/workers/audio-proctor.worker.ts`
- `frontend/src/hooks/useVisionProctoring.ts`
- `frontend/src/hooks/useAudioProctoring.ts`
- `frontend/src/components/exam/WebcamMonitor.tsx`
- `frontend/src/components/exam/ExamInterface.tsx`
- `frontend/src/utils/model-asset.ts`
- `frontend/src/workers/proctoring-runtime-diagnostic.worker.ts`

No thresholds, database schema, migration, or package version changed. The
stale YAMNet asset was replaced with the byte-verified model from its manifest
URL.

## Package and Runtime Versions

| Component | Before | After | Verification |
| --- | --- | --- | --- |
| `@mediapipe/tasks-vision` | `1.0.1` | `1.0.1` | npm `latest` is `1.0.1` |
| `@mediapipe/tasks-audio` | `1.0.1` | `1.0.1` | npm `latest` is `1.0.1` |
| Vision WASM | local package copy | local package copy | all 3 WASM variants byte-match `node_modules` |
| Audio WASM | local package copy | local package copy | all 3 WASM variants byte-match `node_modules` |

## Model Integrity

| Asset | Bytes | SHA-256 | Result |
| --- | ---: | --- | --- |
| `blaze_face_short_range.tflite` | 229,746 | `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f` | PASS |
| `face_landmarker.task` | 3,758,596 | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` | PASS |
| `pose_landmarker_lite.task` | 5,777,746 | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` | PASS |
| `efficientdet_lite0.tflite` | 13,836,895 | `40338edf5ec70d43e318b0a716a84d4564cd1802759a7a07170c7e43796dbf58` | PASS |
| `yamnet.tflite` | 4,126,810 | `4d8b4a53282dc83ef04e3e7dbc4fbc98082e34e44ed798e16c3a0cdd4c584faf` | PASS |

`loadAndVerifyModelAsset()` verifies the YAMNet response is binary, non-empty,
matches `Content-Length` when supplied, contains `TFL3` at offset 4, and
matches the manifest digest before MediaPipe receives it.

## Automated Runtime Self-Test

| Check | Result | Evidence |
| --- | --- | --- |
| Model fetch/SHA-256/header | PASS | Local hashes match manifest; verified buffer utility added |
| Vision WASM byte parity | PASS | All local `.wasm` files match package copies |
| Audio WASM byte parity | PASS | All local `.wasm` files match package copies |
| FaceDetector create | PASS | 453.1 ms; module worker; task closed after test |
| FaceLandmarker create | PASS | 511.3 ms; module worker; task closed after test |
| PoseLandmarker create | PASS | 748.3 ms; module worker; task closed after test |
| ObjectDetector create | PASS | 687.6 ms; module worker; task closed after test |
| AudioClassifier create/silent/test inference | PASS | 412.6 ms; module worker; both buffers returned without crash |
| Worker cleanup | PASS | Each diagnostic worker closes the single task then is terminated after its result |
| Worker recreate | PASS | The full run created fresh independent workers after isolated runs |

Browser diagnostics ran at `http://localhost:5173/dev/proctoring-runtime` on
2026-08-06. Vision and audio WASM-only checks passed in 0.1 ms each. The
diagnostics route retains sanitized errors and raw development details; Student
UI never renders raw runtime errors.

`cd frontend && npm run build` passed after the fix. Vite emitted only its
existing large-chunk warning; no frontend test script is defined.

## Exam and Manual Verification

| Scenario | Result | Reason |
| --- | --- | --- |
| Preflight and panel statuses | BLOCKED | No physical camera/microphone exam session was available |
| One person / no counted event | BLOCKED | Requires real camera session |
| Sustained no face | BLOCKED | Requires real camera session |
| Sustained multiple faces | BLOCKED | Requires real camera session |
| Phone detection | BLOCKED | Requires real camera session |
| Device health and recovery | BLOCKED | Requires real device loss/recovery |
| Sustained speech review flag | BLOCKED | Requires real microphone session |
| Quiet room / fan false-positive checks | BLOCKED | Requires real acoustic environment |
| Teacher timeline and idempotency | BLOCKED | Requires authorized database-backed exam run |

The fail-safe behavior is implemented: a Vision or Audio initialization failure
shows a blocking retry/Dashboard overlay, preserves attempt/session/answers and
backend timer, sends no violation, and never terminates the attempt. Retry
disposes workers/tasks and has a maximum of three manual retries.

## Screenshots and Privacy

Before/after screenshots are not captured because no real exam device session
was run. The code does not store or export camera frames, raw audio, screenshots,
answers, tokens, or student information. Diagnostic exports omit raw errors and
media payloads.

## Remaining Issues

- Production acceptance still requires the blocked real-device exam and Teacher
  checks above.
- Alembic `current` cannot resolve database revision `ccd8210b8297`; repository
  `heads` reports `f3b8d2a7c5e1`. No migration was created or applied.
- `npm audit --audit-level=high` has no high/critical issue; npm reports one
  moderate PostCSS advisory.
