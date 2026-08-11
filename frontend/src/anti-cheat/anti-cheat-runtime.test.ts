import { beforeEach, describe, expect, it, vi } from 'vitest';

const callbacks = vi.hoisted(() => ({
  cameraFailure: null as ((error: Error) => void) | null,
  cameraStop: vi.fn(),
  microphoneStop: vi.fn(),
  cameraReset: vi.fn(),
  microphoneReset: vi.fn(),
}));

vi.mock('./camera/camera-face-runtime', () => ({
  CameraFaceRuntime: class {
    constructor(_stream: MediaStream, _incident: unknown, onRuntimeError: (error: Error) => void) {
      callbacks.cameraFailure = onRuntimeError;
    }
    async start() {}
    stop() { callbacks.cameraStop(); }
    resetForAttemptStart() { callbacks.cameraReset(); }
    setIncidentHandler() {}
  },
}));

vi.mock('./audio/audio-anti-cheat-runtime', () => ({
  AudioAntiCheatRuntime: class {
    constructor(_stream: MediaStream, _incident: unknown, _onRuntimeError: (error: Error) => void) {}
    async start() {}
    stop() { callbacks.microphoneStop(); }
    resetForAttemptStart() { callbacks.microphoneReset(); }
  },
}));

import { AntiCheatRuntime } from './anti-cheat-runtime';

describe('AntiCheatRuntime runtime failures', () => {
  beforeEach(() => {
    callbacks.cameraFailure = null;
    callbacks.cameraStop.mockClear();
    callbacks.microphoneStop.mockClear();
    callbacks.cameraReset.mockClear();
    callbacks.microphoneReset.mockClear();
  });

  it('propagates a post-ready module failure and stops the broken runtime', async () => {
    const runtime = new AntiCheatRuntime({} as MediaStream);
    const onRuntimeError = vi.fn();
    runtime.setRuntimeErrorHandler(onRuntimeError);
    await runtime.start();

    callbacks.cameraFailure?.(new Error('camera inference failed'));

    expect(runtime.hasRuntimeError()).toBe(true);
    expect(onRuntimeError).toHaveBeenCalledWith(expect.objectContaining({ message: 'camera inference failed' }));
    expect(callbacks.cameraStop).toHaveBeenCalledOnce();
    expect(callbacks.microphoneStop).toHaveBeenCalledOnce();
  });

  it('clears preflight detector state before the runtime is handed to an attempt', async () => {
    const runtime = new AntiCheatRuntime({} as MediaStream);
    await runtime.start();

    runtime.resetForAttemptStart();

    expect(callbacks.cameraReset).toHaveBeenCalledOnce();
    expect(callbacks.microphoneReset).toHaveBeenCalledOnce();
  });
});
