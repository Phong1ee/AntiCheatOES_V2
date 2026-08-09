export const CAMERA_AI_CONFIG = {
  inferenceFps: 5,
  noFaceDurationMs: 2_000,
  multipleFacesDurationMs: 1_500,
  headAwayDurationMs: 3_000,
  gazeAwayDurationMs: 3_000,
  incidentCooldownMs: 9_000,
  headYawDegrees: 24,
  headPitchDegrees: 20,
  gazeOffset: 0.24,
} as const;

export const FACE_LANDMARKER_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
export const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
