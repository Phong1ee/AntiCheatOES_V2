import { describe, expect, it } from 'vitest';
import { analyzeSpeakerEvidence, type SpeakerEvidenceConfig } from './speaker-evidence';

const config: SpeakerEvidenceConfig = {
  overlapProbabilityThreshold: 0.55,
  sustainedOverlapMs: 1_200,
  recentOverlapWindowMs: 2_500,
  turnTakingWindowMs: 8_000,
  singleSpeakerProbabilityThreshold: 0.70,
  minimumSpeakerTurnMs: 600,
  minimumSpeakerSwitches: 2,
};

function modelOutput(classes: number[]): Float32Array {
  const output = new Float32Array(classes.length * 7);
  for (let frame = 0; frame < classes.length; frame += 1) {
    for (let label = 0; label < 7; label += 1) {
      output[frame * 7 + label] = Math.log(label === classes[frame] ? 0.98 : 0.02 / 6);
    }
  }
  return output;
}

describe('analyzeSpeakerEvidence', () => {
  it('reports a sustained two-speaker overlap', () => {
    const evidence = analyzeSpeakerEvidence(modelOutput([
      ...Array(75).fill(0), ...Array(13).fill(4), ...Array(12).fill(0),
    ]), config);

    expect(evidence.detectionMode).toBe('overlap');
    expect(evidence.longestContinuousOverlapMs).toBeGreaterThanOrEqual(1_200);
  });

  it('reports conservative sequential turns from two local speaker slots', () => {
    const evidence = analyzeSpeakerEvidence(modelOutput([
      ...Array(20).fill(0), ...Array(7).fill(1), ...Array(7).fill(2),
      ...Array(7).fill(1), ...Array(59).fill(0),
    ]), config);

    expect(evidence.detectionMode).toBe('turn_taking');
    expect(evidence.distinctSpeakerCount).toBe(2);
    expect(evidence.speakerSwitches).toBe(2);
  });

  it('does not report a single speaker, even when speech is sustained', () => {
    const evidence = analyzeSpeakerEvidence(modelOutput([
      ...Array(20).fill(0), ...Array(60).fill(1), ...Array(20).fill(0),
    ]), config);

    expect(evidence.detectionMode).toBeNull();
    expect(evidence.distinctSpeakerCount).toBe(1);
  });
});
