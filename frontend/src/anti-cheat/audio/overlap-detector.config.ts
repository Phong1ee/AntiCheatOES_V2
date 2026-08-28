export interface OverlapDetectorConfig {
  modelUrl: string;
  modelName: string;
  sampleRate: number;
  windowSamples: number;
  recentSpeechGraceMs: number;
  speechActivityProbabilityThreshold: number;
  inferenceIntervalMs: number;
  overlapProbabilityThreshold: number;
  sustainedOverlapMs: number;
  recentOverlapWindowMs: number;
  turnTakingWindowMs: number;
  singleSpeakerProbabilityThreshold: number;
  minimumSpeakerTurnMs: number;
  minimumSpeakerSwitches: number;
  cooldownMs: number;
}

export const OVERLAP_DETECTOR_CONFIG: OverlapDetectorConfig = {
  modelUrl: `${import.meta.env.BASE_URL}models/audio/pyannote-segmentation-3.0-int8.onnx`,
  modelName: 'pyannote-segmentation-3.0-int8',
  sampleRate: 16_000,
  windowSamples: 160_000,
  recentSpeechGraceMs: 2_000,
  // Final exam profile: prioritize short verbal exchanges without recording raw audio.
  inferenceIntervalMs: 125,
  speechActivityProbabilityThreshold: 0.35,
  overlapProbabilityThreshold: 0.50,
  sustainedOverlapMs: 500,
  recentOverlapWindowMs: 1_500,
  turnTakingWindowMs: 4_000,
  singleSpeakerProbabilityThreshold: 0.60,
  minimumSpeakerTurnMs: 400,
  minimumSpeakerSwitches: 1,
  cooldownMs: 3_000,
};
