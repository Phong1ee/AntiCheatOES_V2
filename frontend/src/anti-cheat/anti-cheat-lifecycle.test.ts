import { describe, expect, it, vi } from 'vitest';
import { isBrowserMonitoringActive, startSecuredAttempt, type PreparedSecurityRuntime } from './anti-cheat-lifecycle';

const runtime = (): PreparedSecurityRuntime => ({ stop: vi.fn(), resetForAttemptStart: vi.fn() });

describe('secured attempt lifecycle', () => {
  it('does not require an AI preflight for an anti-cheat-disabled attempt', async () => {
    const preflight = vi.fn();
    const start = vi.fn().mockResolvedValue(undefined);

    await start();

    expect(preflight).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledOnce();
  });

  it('starts only after required preflight and fullscreen succeed', async () => {
    const calls: string[] = [];
    const prepared = runtime();

    const returnedRuntime = await startSecuredAttempt({
      preflight: async () => { calls.push('preflight'); return prepared; },
      requestFullscreen: async () => { calls.push('fullscreen'); },
      startAttempt: async () => { calls.push('start'); },
    });

    expect(calls).toEqual(['preflight', 'fullscreen', 'start']);
    expect(returnedRuntime).toBe(prepared);
    expect(prepared.resetForAttemptStart).toHaveBeenCalledOnce();
  });

  it.each(['MediaPipe', 'Silero', 'Pyannote'])('does not start when %s preflight fails', async (module) => {
    const startAttempt = vi.fn();

    await expect(startSecuredAttempt({
      preflight: async () => { throw new Error(`${module} unavailable`); },
      requestFullscreen: vi.fn(),
      startAttempt,
    })).rejects.toThrow(`${module} unavailable`);

    expect(startAttempt).not.toHaveBeenCalled();
  });

  it('starts exactly once when a later preflight retry succeeds', async () => {
    const prepared = runtime();
    const preflight = vi.fn()
      .mockRejectedValueOnce(new Error('initialization failed'))
      .mockResolvedValueOnce(prepared);
    const startAttempt = vi.fn().mockResolvedValue(undefined);
    const dependencies = {
      preflight,
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
      startAttempt,
    };

    await expect(startSecuredAttempt(dependencies)).rejects.toThrow('initialization failed');
    await startSecuredAttempt(dependencies);

    expect(startAttempt).toHaveBeenCalledOnce();
  });

  it.each([
    [false, 'initializing', false, false],
    [true, 'in_progress', true, true],
    [true, 'in_progress', true, true], // AI ready -> error does not disarm browser monitoring.
    [true, 'submitted', true, false],
    [true, 'terminated', true, false],
    [false, 'in_progress', true, false],
  ])('uses official attempt state, not AI readiness, for browser monitoring', (enabled, status, armed, expected) => {
    expect(isBrowserMonitoringActive(enabled, status, armed)).toBe(expected);
  });
});
