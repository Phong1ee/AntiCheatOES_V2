# Proctoring Performance Baseline

Date: 2026-08-06

## Scope and status

This is a code audit plus a privacy-safe baseline collector. The vision
scheduler was optimized after the baseline: no package, model, detector
threshold, event policy, or audio behavior was changed. No
authenticated browser/hardware exam session was available, so runtime latency,
CPU, memory, p95, and false-positive values are **NOT_MEASURED**.

For a real-device development run:

```powershell
$env:VITE_PROCTORING_DEBUG_METRICS="true"
npm run dev
```

During an anti-cheat attempt, inspect `window.__proctoringMetrics.get()` and
`window.__proctoringMetrics.summary()` in browser DevTools. The collector keeps
at most 500 technical, in-memory entries. It never retains or transmits a
camera frame, raw audio, transcript, or full landmark array.

## Current architecture

- Three independent module workers own face, pose, and EfficientDet object
  detection. The face worker first uses local BlazeFace Short Range for real
  confidence, count, and box; it invokes Face Landmarker only for exactly one
  accepted face. No detector invocation waits for another worker.
- `useVisionProctoring` has one timer, in-flight gate, sequence ID, and stale
  response check per detector. Face runs at 150 ms (6.7 FPS) for presence/count;
  face-detail evaluation runs at 200 ms (5 FPS); pose and phone run at 400 ms
  (2.5 FPS). Each worker has at most one outstanding frame.
- Preflight/recovery requests video with ideal 640x480 and 15 FPS, maximum 20
  FPS, plus the existing audio constraint. Frames are downscaled to 320x240
  before transfer to every worker; bitmaps are transferred, closed in workers,
  and never persisted.
- Audio uses a continuous mono PCM AudioWorklet capture. It down-samples to
  YAMNet's 16 kHz rate, analyses every 500 ms, and sends a 1-second classifier
  window every 500 ms (50% overlap) only when no previous classification is
  pending. ScriptProcessor with a zero-gain output is an explicitly recorded
  browser fallback; no microphone audio is audible, stored, or uploaded.
- Backend event classification is centralized. Teacher Monitor uses persisted
  `automatedFlag` and `countsTowardLimit` fields.

## Versions and assets

| Item | Exact version / asset |
| --- | --- |
| `@mediapipe/tasks-vision` | `1.0.1` |
| `@mediapipe/tasks-audio` | `1.0.1` |
| Face detector | BlazeFace Short Range float16 v1, 229,746 bytes |
| Face model | Face Landmarker float16 v1, 3,758,596 bytes |
| Pose model | Pose Landmarker Lite float16 v1, 5,777,746 bytes |
| Phone model | EfficientDet Lite0 float32 v1, 13,836,895 bytes, `cell phone` label |
| Speech model | YAMNet float32 v1, 2,371,584 bytes, `Speech` label |
| Models / runtime / combined | 24.77 / 53.22 / 78.00 MiB |

Sources, SHA-256 checksums, terms, labels, and limitations are in
`frontend/public/models/anti-cheat/MODEL_MANIFEST.md`.

## Instrumented baseline fields

| Area | Collected technical metrics |
| --- | --- |
| Face, pose, phone | WASM/model/pipeline load, individual inference, interval, drops/reason, independent in-flight depth, event/cooldown state |
| Audio energy and speech | stream sample rate, analyser/window duration, interval, classifier pending count, model load, inference, event duration/cooldown state |
| Camera | actual track width, height, frame rate |
| Main thread | one-second timer drift, Long Task duration where supported |
| Event API | accepted vs duplicate response, count-affecting status, server violation count |

`summary()` provides average duration and p95 only after 20 duration samples.

## Runtime baseline this audit

| Measure | Result |
| --- | --- |
| Model load; face/pose/phone/speech average and p95 | NOT_MEASURED |
| Actual sampling interval, drops, queue depth | NOT_MEASURED |
| Actual camera resolution/frame rate; audio sample rate/window | NOT_MEASURED |
| Condition-to-event latency; cooldown/duplicates | NOT_MEASURED |
| CPU, memory, UI responsiveness, false positives | NOT_MEASURED |

## Evidence-backed findings

1. The pre-optimization baseline had sequential vision calls in one worker and
   a shared `inFlight` gate. This has been removed: face, pose, and phone now
   have separate workers and bounded queues, so phone cannot delay no-face.
2. Video capture is now requested at 640x480 ideal, 15 FPS ideal / 20 FPS max;
   browser negotiation can still choose a different supported setting, which is
   recorded by `MediaStreamTrack.getSettings()` in debug mode.
3. The former discrete one-second polling has been replaced by continuous PCM
   capture with bounded worklet backpressure telemetry.
4. Classifier requests are now bounded at one; each has a sequence ID and a
   stale result is discarded rather than emitting a delayed event.
5. Speech now uses one state machine: its N/M confidence history and the same
   4-second candidate interval determine emission, with no second duration.
6. The previous fixed face confidence has been removed. BlazeFace now supplies
   the real accepted detection score for count, no-face/multiple-face logic,
   and quality.
7. Face quality is normalized from 30% real detection confidence, 25% size
   suitability across an acceptable range, 20% brightness suitability, 15%
   contrast, and 10% sharpness. Debug metrics expose the five components only.
8. Head pose now uses Face Landmarker facial transformation matrices and an EMA
   smoothing filter. If a matrix is absent, head/gaze estimation is disabled
   and logged as `disabled_no_matrix`; it does not fall back to nose/eye math.
9. Gaze is a calibrated review-only approximation: 2.5 seconds of accepted
   face samples establish iris/head baseline before sustained deviation can flag.
10. Development and production policy differ greatly: audio calibration is
   0.5 vs 5 seconds, speech is 0.30/1-of-2 vs 0.75/4-of-5, and several
   cooldowns are 2 vs 30 seconds. Dev results do not prove production behavior.

## Hypotheses requiring real measurements

- Browser negotiation may choose a capture setting different from the requested
  640x480/15 FPS target.
- Low-end CPUs may still generate detector-local `in_flight` drops; they no
  longer suppress unrelated detector samples.
- AudioWorklet availability and fallback behavior must be measured on target
  browsers; capture drops are explicitly surfaced in debug metrics.
- Lighting, distance, occlusion, fan noise, and keyboard sound may affect
  false positives/negatives; their rates are unknown.

## Optimization priority after baseline capture

1. Record model load, detector average/p95, intervals, drops, max pending
   audio requests, and main-thread drift on low/mid/high devices.
2. Compare independent worker p95 and detector-local dropped samples to confirm
   that the 6.7/5/2.5 FPS targets hold on real hardware.
3. If image quality becomes insufficient, choose another explicit camera target
   only after measuring framing and accuracy at candidate resolutions.
4. Benchmark AudioWorklet versus the visible ScriptProcessor fallback for CPU,
   capture drops, classifier p95, and speech-condition-to-event latency.
5. Run the manual face matrix, gaze calibration, lighting, glasses, and blur
   matrix before treating quality/gaze flags as strong signals.
6. Align development and production policy only through a separate approved
   policy decision.

For each real scenario record browser/device, camera resolution, CPU/memory
observations, UI responsiveness, and labelled false positives; mark results
PASS, FAIL, BLOCKED, or MANUAL_REQUIRED. Do not claim 100% accuracy.

## Phone detector optimization

- The existing verified EfficientDet `cell phone` model remains unchanged. Its
  independent worker runs at 2.5 FPS with one in-flight bitmap and stale result
  rejection, so it cannot delay face detection.
- Input stays downscaled to 320x240. Development metrics record category,
  confidence, inference duration, accepted/rejected status, normalized box
  area, and whether the box is fully in-frame; no image is retained.
- A candidate must meet the existing 0.70 confidence, normalized area 0.012,
  valid frame bounds, and the existing 3 samples in 2 seconds before the
  sustained event can be emitted. Low-confidence/small/partial candidates are
  metrics only.
- Real-device cases still required: no phone, close/far/partial/dark phone,
  remote control, calculator, rectangular object, one-frame phone, and
  sustained phone. Their accuracy is NOT_MEASURED in this environment.

## Central policy and device capability

- `proctoring-policy.ts` is the single typed source for capture constraints,
  sampling, confidence, duration, N/M confirmation, recovery, cooldown,
  quality weights, and audio calibration. Every detection metadata payload uses
  policy version `1`.
- Production uses the stable `standard` profile. The explicit
  `VITE_PROCTORING_POLICY_PROFILE=test` profile does not alter business
  thresholds; it exists only as a visible sampling-profile switch. No `DEV`
  branch changes event confidence, duration, cooldown, or media health.
- Capability assessment reads only `hardwareConcurrency` when supplied,
  camera settings, Worker support, AudioWorklet support, and measured debug
  latency. It recommends `low_power` on two-or-fewer cores, which may slow
  sampling only; camera/microphone health monitoring is never disabled.
- Calibration test set results for normal/low/backlight, people count, phone,
  fan, keyboard, speech, and whisper remain MANUAL_REQUIRED. Threshold reasons
  are the existing approved sustained-evidence policy, not measured claims.
