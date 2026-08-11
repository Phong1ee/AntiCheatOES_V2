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

export function isBrowserMonitoringActive(
  antiCheatEnabled: boolean,
  attemptStatus: string,
  monitoringArmed: boolean,
): boolean {
  return antiCheatEnabled && attemptStatus === 'in_progress' && monitoringArmed;
}
