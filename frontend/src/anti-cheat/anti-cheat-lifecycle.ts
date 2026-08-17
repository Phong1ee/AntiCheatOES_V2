import { AntiCheatRuntime } from './anti-cheat-runtime';

export interface PreparedSecurityRuntime {
  stop: () => void;
  resetForAttemptStart?: () => void;
}

interface SecureStartDependencies<TRuntime extends PreparedSecurityRuntime> {
  preflight: () => Promise<TRuntime>;
  requestFullscreen: () => Promise<void>;
  startAttempt: (runtime: TRuntime) => Promise<void>;
}

// Fullscreen must be requested first, still inside the click's user-activation
// window: some browsers (e.g. Vivaldi) reject requestFullscreen() once that
// window has lapsed, which the AI preflight below is slow enough to cause.
export async function startSecuredAttempt<TRuntime extends PreparedSecurityRuntime>({
  preflight,
  requestFullscreen,
  startAttempt,
}: SecureStartDependencies<TRuntime>): Promise<TRuntime> {
  await requestFullscreen();
  const runtime = await preflight();
  try {
    await startAttempt(runtime);
    runtime.resetForAttemptStart?.();
    return runtime;
  } catch (error) {
    runtime.stop();
    throw error;
  }
}

export async function preflightAntiCheatRuntime(stream: MediaStream): Promise<AntiCheatRuntime> {
  const runtime = new AntiCheatRuntime(stream);
  try {
    await runtime.start();
    return runtime;
  } catch (error) {
    runtime.stop();
    throw error;
  }
}

/**
 * A fullscreen exit only counts while the exam is still running. Submitting,
 * being terminated, and leaving deliberately all drop fullscreen themselves;
 * treating those as violations throws the security gate back up on the way
 * out, stranding the student behind a "Return to Fullscreen" screen for an
 * exit they asked for. A page refresh (unloading) is likewise not an exit.
 */
export function isFullscreenExitReportable(
  inFullscreen: boolean,
  unloading: boolean,
  ignoringEvents: boolean,
): boolean {
  return !inFullscreen && !unloading && !ignoringEvents;
}

/**
 * One browser action can fire blur, visibility and fullscreen together, so a
 * short window charges only the first of that burst. But a repeat of a *user
 * action* is a new violation, not collateral from the previous one: exiting
 * fullscreen again is its own act, and folding it into the window let a student
 * cycle exit/return faster than the window and stay under the limit forever.
 */
export function isChargeableViolation(
  now: number,
  lastBurstAt: number,
  ownAction: boolean,
  burstMs = 1_500,
): boolean {
  return ownAction || now - lastBurstAt >= burstMs;
}

export function isBrowserMonitoringActive(
  antiCheatEnabled: boolean,
  attemptStatus: string,
  monitoringArmed: boolean,
): boolean {
  return antiCheatEnabled && attemptStatus === 'in_progress' && monitoringArmed;
}
