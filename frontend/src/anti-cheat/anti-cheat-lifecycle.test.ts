import { describe, expect, it, vi } from 'vitest';
import { isBrowserMonitoringActive, isChargeableViolation, isFullscreenExitReportable, startSecuredAttempt, type PreparedSecurityRuntime } from './anti-cheat-lifecycle';

const runtime = (): PreparedSecurityRuntime => ({ stop: vi.fn(), resetForAttemptStart: vi.fn() });

describe('secured attempt lifecycle', () => {
  it('does not require an AI preflight for an anti-cheat-disabled attempt', async () => {
    const preflight = vi.fn();
    const start = vi.fn().mockResolvedValue(undefined);

    await start();

    expect(preflight).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledOnce();
  });

  it('requests fullscreen before the AI preflight so the click user-activation is not lost', async () => {
    const calls: string[] = [];
    const prepared = runtime();

    const returnedRuntime = await startSecuredAttempt({
      preflight: async () => { calls.push('preflight'); return prepared; },
      requestFullscreen: async () => { calls.push('fullscreen'); },
      startAttempt: async () => { calls.push('start'); },
    });

    expect(calls).toEqual(['fullscreen', 'preflight', 'start']);
    expect(returnedRuntime).toBe(prepared);
    expect(prepared.resetForAttemptStart).toHaveBeenCalledOnce();
  });

  it('does not preflight or create an attempt when fullscreen cannot be entered', async () => {
    const preflight = vi.fn();
    const startAttempt = vi.fn();

    await expect(startSecuredAttempt({
      requestFullscreen: async () => {
        throw new Error('Your browser did not enter fullscreen mode.');
      },
      preflight,
      startAttempt,
    })).rejects.toThrow('did not enter fullscreen');

    expect(preflight).not.toHaveBeenCalled();
    expect(startAttempt).not.toHaveBeenCalled();
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

  it.each([
    ['is still held', true, false, false, false],
    ['ends mid-exam', false, false, false, true],
    ['ends because the page is unloading', false, true, false, false],
    ['is dropped by the exam itself on submit, termination, or exit', false, false, true, false],
  ])('does not gate the student when fullscreen %s', (_case, inFullscreen, unloading, ignoring, expected) => {
    expect(isFullscreenExitReportable(inFullscreen, unloading, ignoring)).toBe(expected);
  });

  it.each([
    ['collateral from the same action', 1_000, 900, false, false],
    ['collateral once the burst window has passed', 3_000, 900, false, true],
    ['the student acting again inside the window', 1_000, 900, true, true],
  ])('charges %s', (_case, now, lastBurstAt, ownAction, expected) => {
    expect(isChargeableViolation(now, lastBurstAt, ownAction)).toBe(expected);
  });

  it('charges every fullscreen exit however fast the student cycles out and back', () => {
    // Escape spam: five exits, all well inside one 1.5s burst window.
    const exits = [0, 200, 400, 600, 800];
    const charge = (ownAction: boolean) => {
      let lastBurstAt = -Infinity;
      return exits.filter((at) => {
        if (!isChargeableViolation(at, lastBurstAt, ownAction)) return false;
        lastBurstAt = at;
        return true;
      });
    };

    // Treated as collateral, the window swallows all but the first - the hole
    // that let a student exit indefinitely without reaching the limit.
    expect(charge(false)).toEqual([0]);
    expect(charge(true)).toEqual(exits);
  });
});
