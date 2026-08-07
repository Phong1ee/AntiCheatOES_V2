export const PROCTORING_POLICY_VERSION = "1";
export type ProctoringPolicyProfile = "standard" | "test" | "low_power";
export const PROCTORING_POLICY_PROFILE: ProctoringPolicyProfile = import.meta.env.VITE_PROCTORING_POLICY_PROFILE === "test" ? "test" : "standard";
const samplingProfile = PROCTORING_POLICY_PROFILE === "test" ? { facePresenceIntervalMs: 150, faceLandmarksIntervalMs: 200, poseIntervalMs: 400, objectIntervalMs: 400 } : { facePresenceIntervalMs: 150, faceLandmarksIntervalMs: 200, poseIntervalMs: 400, objectIntervalMs: 400 };
export const LOW_POWER_SAMPLING = { facePresenceIntervalMs: 200, faceLandmarksIntervalMs: 250, poseIntervalMs: 500, objectIntervalMs: 500 } as const;

export const MEDIA_CAPTURE_CONSTRAINTS: MediaStreamConstraints = {
  video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 } },
  audio: true,
};

export const VISION_POLICY = {
  sampling: {
    ...samplingProfile,
    frameWidth: 320,
    frameHeight: 240,
  },
  faceDetection: { minimumConfidence: 0.6 },
  phone: { confidence: 0.7, minimumBoxArea: 0.012, requiredSamples: 3, windowMs: 2_000, recoveryMs: 3_000, cooldownMs: 30_000, categoryName: "cell phone" },
  mediaHealth: { muteDurationMs: 3_000, recoveryMs: 2_000, cooldownMs: 30_000 },
  audio: { calibrationMs: 5_000, analysisHopMs: 500, modelSampleRate: 16_000, classifierSampleMs: 1_000, classifierHopMs: 500, activityDurationMs: 5_000, speechSustainedMs: 4_000, speechConfidence: 0.75, speechWindows: 4, speechWindowSize: 5, recoveryMs: 3_000, cooldownMs: 30_000, clippingRatio: 0.02, dcOffset: 0.08, nearZeroLevel: 0.0005, nearZeroDurationMs: 5_000, noiseMultiplier: 8, activityFloor: 0.01, baselineMin: 0.0001, baselineMax: 0.2 },
  noFace: { triggerMs: 5_000, recoveryMs: 2_000, cooldownMs: 20_000 },
  multipleFaces: { confidence: 0.6, requiredSamples: 4, windowSamples: 5, triggerMs: 3_000, recoveryMs: 2_000, cooldownMs: 20_000 },
  facePosition: { triggerMs: 8_000, recoveryMs: 2_000, cooldownMs: 30_000, minX: 0.2, maxX: 0.8, minY: 0.15, maxY: 0.8, minArea: 0.06, maxArea: 0.45 },
  quality: { triggerMs: 10_000, recoveryMs: 3_000, cooldownMs: 30_000, triggerScore: 0.45, recoveryScore: 0.55, size: { acceptableMin: 0.06, preferredMin: 0.12, preferredMax: 0.30, acceptableMax: 0.45 }, brightness: { acceptableMin: 0.25, acceptableMax: 0.75, limitMin: 0.08, limitMax: 0.92 }, contrastReference: 0.25, sharpnessReference: 32 },
  shoulders: { triggerMs: 8_000, recoveryMs: 2_000, cooldownMs: 30_000, minimumVisibility: 0.5, requiredSamples: 4, windowSamples: 5 },
  gaze: { triggerMs: 5_000, recoveryMs: 3_000, cooldownMs: 20_000, calibrationMs: 2_500, minimumConfidence: 0.6, irisDeviation: 0.04 },
  headPose: { triggerMs: 5_000, recoveryMs: 3_000, cooldownMs: 20_000, yaw: 25, pitch: 20, roll: 25 },
  repeatedHeadMovement: { reversals: 6, amplitudeDegrees: 15, windowMs: 10_000, cooldownMs: 20_000 },
} as const;

// Quality is normalized: 35% accepted face-detection confidence, 35% face
// size suitability, and 30% transient grayscale sharpness. No image data is retained.
export const QUALITY_SCORE_DOCUMENTATION = "0.30 * detection confidence + 0.25 * face-size suitability + 0.20 * brightness suitability + 0.15 * normalized contrast + 0.10 * normalized sharpness";
