# Face Landmarker asset

`face_landmarker.task` is the official MediaPipe Face Landmarker float16 model,
downloaded from the MediaPipe published model location. It is served locally so
an anti-cheat exam never fetches the model from a CDN at runtime.

MediaPipe Tasks Vision 1.0.1 WASM runtime files are copied from the installed
`@mediapipe/tasks-vision` package into `public/mediapipe` during the existing
`npm run prepare:vad-assets` step. The package license is Apache-2.0.

SCRFD-10GF is intentionally not in `public/`: its license/redistribution review
is unresolved. The exact verified candidate is served only by the local Vite
development evaluation middleware from `frontend/evaluation-assets/`.

`face_detection_yunet_2023mar.onnx` is the OpenCV Zoo YuNet March 2023 model
used for the Phase 1 production-like migration audit. Its SHA-256 is
`8F2383E4DD3CFBB4553EA8718107FC0423210DC964F9F4280604804ED2552FA4`; it is
Apache-2.0 licensed and copied byte-for-byte from `frontend/evaluation-assets/`.
It is the primary production face-count model. MediaPipe Face Landmarker remains
available as a session-scoped fallback if YuNet has a critical runtime failure.
