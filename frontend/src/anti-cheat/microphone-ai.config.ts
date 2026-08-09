export const MICROPHONE_AI_CONFIG = {
  baseAssetPath: `${import.meta.env.BASE_URL}vad/`,
  model: 'v5' as const,
  positiveSpeechThreshold: 0.82,
  negativeSpeechThreshold: 0.42,
  minimumSpeechDurationMs: 2_000,
  silenceRedemptionMs: 500,
  cooldownMs: 10_000,
} as const;
