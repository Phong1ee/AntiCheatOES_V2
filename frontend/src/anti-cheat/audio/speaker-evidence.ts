export interface SpeakerEvidenceConfig {
  overlapProbabilityThreshold: number;
  sustainedOverlapMs: number;
  recentOverlapWindowMs: number;
  turnTakingWindowMs: number;
  singleSpeakerProbabilityThreshold: number;
  minimumSpeakerTurnMs: number;
  minimumSpeakerSwitches: number;
}

export interface SpeakerEvidence {
  peakOverlapProbability: number;
  p95OverlapProbability: number;
  overlapFrameRatio: number;
  longestContinuousOverlapMs: number;
  recentContinuousOverlapMs: number;
  distinctSpeakerCount: number;
  qualifyingSpeakerTurns: number;
  speakerSwitches: number;
  detectionMode: 'overlap' | 'turn_taking' | null;
}

// The model's seven LogSoftmax classes are the powerset of three local speaker
// slots: silence, each single speaker, then each two-speaker combination.
const POWESET_CLASS_SPEAKERS: ReadonlyArray<ReadonlyArray<number>> = [
  [], [0], [1], [2], [0, 1], [0, 2], [1, 2],
];

function softmax(logProbabilities: Float32Array, offset: number): number[] {
  let max = -Infinity;
  for (let index = 0; index < POWESET_CLASS_SPEAKERS.length; index += 1) {
    max = Math.max(max, logProbabilities[offset + index]);
  }
  let denominator = 0;
  const probabilities = POWESET_CLASS_SPEAKERS.map((_, index) => {
    const probability = Math.exp(logProbabilities[offset + index] - max);
    denominator += probability;
    return probability;
  });
  return probabilities.map((probability) => probability / denominator);
}

export function analyzeSpeakerEvidence(output: Float32Array, config: SpeakerEvidenceConfig): SpeakerEvidence {
  const frameCount = Math.floor(output.length / POWESET_CLASS_SPEAKERS.length);
  const frameDurationMs = frameCount ? 10_000 / frameCount : 0;
  const overlapFirstFrame = Math.max(0, frameCount - Math.ceil(config.recentOverlapWindowMs / frameDurationMs));
  const turnsFirstFrame = Math.max(0, frameCount - Math.ceil(config.turnTakingWindowMs / frameDurationMs));
  let peak = 0;
  let matchingFrames = 0;
  let longestOverlapRun = 0;
  let currentOverlapRun = 0;
  const overlapProbabilities: number[] = [];
  const turns: Array<{ speaker: number; frames: number }> = [];
  let activeTurn: { speaker: number; frames: number } | null = null;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const probabilities = softmax(output, frame * POWESET_CLASS_SPEAKERS.length);
    const overlapProbability = probabilities.slice(4).reduce((sum, probability) => sum + probability, 0);

    if (frame >= overlapFirstFrame) {
      overlapProbabilities.push(overlapProbability);
      peak = Math.max(peak, overlapProbability);
      if (overlapProbability >= config.overlapProbabilityThreshold) {
        matchingFrames += 1;
        currentOverlapRun += 1;
        longestOverlapRun = Math.max(longestOverlapRun, currentOverlapRun);
      } else currentOverlapRun = 0;
    }

    if (frame < turnsFirstFrame) continue;
    let speaker: number | null = null;
    for (let index = 0; index < 3; index += 1) {
      if (probabilities[index + 1] >= config.singleSpeakerProbabilityThreshold) {
        speaker = index;
        break;
      }
    }
    if (speaker === null) {
      if (activeTurn) turns.push(activeTurn);
      activeTurn = null;
    } else if (activeTurn?.speaker === speaker) {
      activeTurn.frames += 1;
    } else {
      if (activeTurn) turns.push(activeTurn);
      activeTurn = { speaker, frames: 1 };
    }
  }
  if (activeTurn) turns.push(activeTurn);

  const qualifyingTurns = turns.filter((turn) => turn.frames * frameDurationMs >= config.minimumSpeakerTurnMs);
  let speakerSwitches = 0;
  for (let index = 1; index < qualifyingTurns.length; index += 1) {
    if (qualifyingTurns[index - 1].speaker !== qualifyingTurns[index].speaker) speakerSwitches += 1;
  }
  const distinctSpeakerCount = new Set(qualifyingTurns.map((turn) => turn.speaker)).size;
  const sustainedOverlap = peak >= config.overlapProbabilityThreshold
    && longestOverlapRun * frameDurationMs >= config.sustainedOverlapMs;
  const sustainedTurnTaking = distinctSpeakerCount >= 2 && speakerSwitches >= config.minimumSpeakerSwitches;
  const sorted = [...overlapProbabilities].sort((left, right) => left - right);

  return {
    peakOverlapProbability: peak,
    p95OverlapProbability: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
    overlapFrameRatio: overlapProbabilities.length ? matchingFrames / overlapProbabilities.length : 0,
    longestContinuousOverlapMs: longestOverlapRun * frameDurationMs,
    recentContinuousOverlapMs: currentOverlapRun * frameDurationMs,
    distinctSpeakerCount,
    qualifyingSpeakerTurns: qualifyingTurns.length,
    speakerSwitches,
    detectionMode: sustainedOverlap ? 'overlap' : sustainedTurnTaking ? 'turn_taking' : null,
  };
}
