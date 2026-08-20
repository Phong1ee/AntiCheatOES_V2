export const CAMERA_AI_CONFIG = {
  // Face Landmarker is intentionally capped on the main thread to protect exam interaction.
  mainThreadMaxFps: 4,
  noFaceDurationMs: 2_000,
  multipleFacesDurationMs: 1_500,
  headAwayDurationMs: 3_000,
  gazeAwayDurationMs: 3_000,
  incidentCooldownMs: 9_000,
  headYawDegrees: 25,
  headPitchDegrees: 20,
  gazeOffset: 0.24,
  smoothingAlpha: 0.35,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
} as const;

export const FACE_LANDMARKER_WASM_URL =
  `${import.meta.env.BASE_URL}mediapipe`;
export const FACE_LANDMARKER_MODEL_URL =
  `${import.meta.env.BASE_URL}models/camera/face_landmarker.task`;

export const SCRFD_10GF_MODEL_URL =
  import.meta.env.DEV ? '/__camera-evaluation-assets/scrfd_10gf.onnx' : '';
export const BLAZEFACE_SHORT_MODEL_URL = import.meta.env.DEV ? '/__camera-evaluation-assets/blaze_face_short_range.tflite' : '';
export const YUNET_MODEL_URL = import.meta.env.DEV ? '/__camera-evaluation-assets/face_detection_yunet_2023mar.onnx' : '';

export const CAMERA_MODEL_COMPARISON_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_CAMERA_MODEL_COMPARISON === 'true';
