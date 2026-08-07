# Proctoring Model Comparison

Date: 2026-08-06

## Decision

**BLOCKED - retain all current models.** `PROCTORING_BASELINE_REPORT.md`
contains no real-device latency, p95, CPU/memory, accuracy, or false-positive
measurements. The prerequisite for this phase (benchmark evidence that the
current model misses requirements) is therefore not met. No package, model, or
asset was downloaded, replaced, or removed.

## Supply-chain gate

- Production assets must be local under `frontend/public/models/anti-cheat/`.
- Candidate source must be official; version, SHA-256, size, license/terms,
  labels, browser support, and rollback path must be recorded before use.
- No executable, conversion script, unverified binary, unpinned CDN, or custom
  model is permitted in this evaluation.

## Current verified models

| Detector | Model | Source/version/checksum/license | Labels | Measured load/p95/accuracy/CPU |
| --- | --- | --- | --- | --- |
| Face | BlazeFace Short Range + Face Landmarker | Official MediaPipe float16 v1; SHA/terms in manifest | face box/confidence; 478 landmarks | NOT_MEASURED |
| Pose | Pose Landmarker Lite | Official MediaPipe float16 v1; SHA/terms in manifest | 33 landmarks/shoulders | NOT_MEASURED |
| Phone | EfficientDet Lite0 | Official MediaPipe float32 v1; SHA/terms in manifest | exact `cell phone` | NOT_MEASURED |
| Audio | YAMNet | Official MediaPipe float32 v1; SHA/terms in manifest | exact `Speech` | NOT_MEASURED |

All current model file sizes, exact sources, checksums, and limitations are in
`frontend/public/models/anti-cheat/MODEL_MANIFEST.md`. Current browser support
is MediaPipe Tasks Web browser support; real target-browser compatibility is
MANUAL_REQUIRED.

## Candidate evaluation - not downloaded or evaluated

| Area | Candidate | Status / reason |
| --- | --- | --- |
| Face | Keep short-range detector plus conditional landmarker | RETAIN: no evidence that current measured latency/recall is inadequate |
| Pose | MediaPipe Pose Full | BLOCKED: no Lite shoulder recall, p95, memory, or low-end-device comparison |
| Phone | Official quantized/int8 EfficientDet variant | BLOCKED: exact compatible asset/version/checksum and local phone benchmark not verified |
| Phone | Other official lightweight model or custom phone-only model | BLOCKED: no official pinned candidate evaluated; custom-model dataset/training/license/validation absent |
| Audio | Custom acoustic classifier for noise/fan/keyboard/speech/etc. | BLOCKED: no labelled local dataset, training pipeline, licence, validation, or false-positive benchmark |

No custom audio classifier may infer speaker identity or multiple speakers.

## Dependency supply-chain check

- `npm audit signatures`: PASS - 220 registry signatures and 24 attestations
  verified.
- `npm audit --audit-level=high`: PASS for the requested high threshold. It
  reports one separate **moderate** PostCSS advisory (`GHSA-fxqj-rqcc-2cmp`)
  with `npm audit fix` available. No automatic dependency update was run.

## Required evidence before a replacement

For the current model and a candidate, collect same-device/browser test data:
load time, average/p95 inference, CPU/memory, face/shoulder/phone recall,
labelled false positives, UI responsiveness, and low-end-device result. A
replacement needs a documented improvement, clear license/source/checksum,
browser compatibility, successful build, and retained current asset as rollback
until the migration passes. Without this evidence, the decision remains BLOCKED.
