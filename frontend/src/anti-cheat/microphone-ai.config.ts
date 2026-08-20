export const MICROPHONE_CAPTURE_PROFILE = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
} as const;

// Apply only after real-device evidence shows echo-driven false positives.
export const MICROPHONE_ECHO_FALLBACK_PROFILE = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
} as const;

export const MICROPHONE_AI_CONFIG = {
  baseAssetPath: `${import.meta.env.BASE_URL}vad/`,
  model: 'v5' as const,
  positiveSpeechThreshold: 0.7,
  negativeSpeechThreshold: 0.55,
  realSpeechActivationMs: 750,
  // This resets VAD segmentation only; it does not create a single-voice violation.
  silenceRedemptionMs: 700,
  cooldownMs: 10_000,
} as const;
