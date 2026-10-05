import { beforeEach, describe, expect, it, vi } from 'vitest';

const worker = vi.hoisted(() => ({
  terminate: vi.fn(),
  postMessage: vi.fn(),
  onmessage: null as ((event: MessageEvent) => void) | null,
  onerror: null as (() => void) | null,
}));

vi.mock('./overlap-detector.worker?worker', () => ({
  default: class {
    postMessage = worker.postMessage;
    terminate = worker.terminate;
    onmessage = worker.onmessage;
    onerror = worker.onerror;
  },
}));

import { OverlapDetector } from './overlap-detector';
import { OVERLAP_DETECTOR_CONFIG } from './overlap-detector.config';

describe('OverlapDetector resume safety', () => {
  beforeEach(() => {
    worker.terminate.mockClear();
  });

  it('drops microphone frames during the fresh-session warm-up', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1_000);
    const detector = new OverlapDetector(vi.fn(), vi.fn(), {
      ...OVERLAP_DETECTOR_CONFIG,
      resumeWarmupMs: 2_000,
    });
    const internal = detector as unknown as { sampleCount: number };

    detector.resetForAttemptStart();
    detector.observeVadFrame(0.9, new Float32Array([0.1, 0.2]));
    expect(internal.sampleCount).toBe(0);

    now.mockReturnValue(3_000);
    detector.observeVadFrame(0.9, new Float32Array([0.1, 0.2]));
    expect(internal.sampleCount).toBe(2);

    now.mockRestore();
  });

  it('prevents any late microphone frame from being retained after stop', () => {
    const detector = new OverlapDetector(vi.fn());
    const internal = detector as unknown as { sampleCount: number };

    detector.stop();
    detector.observeVadFrame(0.9, new Float32Array([0.1]));

    expect(internal.sampleCount).toBe(0);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
