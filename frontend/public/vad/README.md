# Self-hosted Silero VAD assets

`npm run prepare:vad-assets` copies the runtime assets required by
`@ricky0123/vad-web` into this directory before development and production builds:

- `silero_vad_v5.onnx` - Silero VAD model
- `vad.worklet.bundle.min.js` - VAD audio processing worklet

The VAD hook loads these files from `/vad/`. Vite imports the ONNX Runtime
WASM module and binary from `onnxruntime-web` so the runtime is emitted as
build assets rather than imported directly from `public/`.
