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
