import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraFaceRuntime } from './camera-face-runtime';
import type { CameraFaceDetectionResult, CameraFaceDetector } from './detectors/camera-face-detector';

const video = {
  muted: false,
  playsInline: false,
  srcObject: null as MediaStream | null,
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
};

function detector(faceCount = 1): CameraFaceDetector & { detect: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> } {
  const result: CameraFaceDetectionResult = {
    faceCount,
    predictedClass: faceCount === 0 ? 'NO_FACE' : faceCount === 1 ? 'ONE_FACE' : 'MULTIPLE_FACES',
    inferenceMs: 1,
  };
  return {
    id: 'test-detector', displayName: 'Test detector', executionProvider: 'test',
    load: vi.fn().mockResolvedValue(undefined), detect: vi.fn().mockResolvedValue(result), dispose: vi.fn(),
  };
}

const stream = () => ({ getVideoTracks: () => [{ readyState: 'live' }] }) as unknown as MediaStream;
const infer = (runtime: CameraFaceRuntime) => (runtime as unknown as { inferLatestFrame(): Promise<void> }).inferLatestFrame();

describe('CameraFaceRuntime YuNet primary migration', () => {
  beforeEach(() => {
    video.play.mockClear();
    video.pause.mockClear();
    vi.stubGlobal('document', { createElement: vi.fn(() => video) });
    vi.stubGlobal('window', { setTimeout: vi.fn(() => 1), clearTimeout: vi.fn() });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses YuNet as the single primary detector during normal monitoring', async () => {
    const primary = detector();
    const fallback = detector();
    const runtime = new CameraFaceRuntime(stream(), vi.fn(), undefined, { primaryDetector: primary, fallbackDetector: fallback });

    await runtime.start();
    await infer(runtime);

    expect(primary.load).toHaveBeenCalledOnce();
    expect(primary.detect).toHaveBeenCalledOnce();
    expect(fallback.load).not.toHaveBeenCalled();
  });

  it('starts MediaPipe fallback when YuNet cannot load', async () => {
    const primary = detector();
    primary.load.mockRejectedValueOnce(new Error('YuNet model unavailable'));
    const fallback = detector();
    const runtime = new CameraFaceRuntime(stream(), vi.fn(), undefined, { primaryDetector: primary, fallbackDetector: fallback });

    await runtime.start();

    expect(primary.load).toHaveBeenCalledOnce();
    expect(fallback.load).toHaveBeenCalledOnce();
  });

  it('switches once to MediaPipe after an unrecoverable YuNet inference error', async () => {
    const primary = detector();
    primary.detect.mockRejectedValueOnce(new Error('YuNet inference failed'));
    const fallback = detector();
    const onRuntimeError = vi.fn();
    const runtime = new CameraFaceRuntime(stream(), vi.fn(), onRuntimeError, { primaryDetector: primary, fallbackDetector: fallback });

    await runtime.start();
    await infer(runtime);
    await Promise.resolve();

    expect(primary.dispose).toHaveBeenCalledOnce();
    expect(fallback.load).toHaveBeenCalledOnce();
    expect(onRuntimeError).not.toHaveBeenCalled();
  });

  it('disposes the active detector on stop', async () => {
    const primary = detector();
    const runtime = new CameraFaceRuntime(stream(), vi.fn(), undefined, { primaryDetector: primary });

    await runtime.start();
    runtime.resetForAttemptStart();
    runtime.stop();

    expect(primary.dispose).toHaveBeenCalledOnce();
  });
});
