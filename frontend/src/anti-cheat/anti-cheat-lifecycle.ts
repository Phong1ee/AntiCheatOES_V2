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

// Keep the backend attempt behind every client-side security gate.
export async function startSecuredAttempt<TRuntime extends PreparedSecurityRuntime>({
  preflight,
  requestFullscreen,
  startAttempt,
}: SecureStartDependencies<TRuntime>): Promise<TRuntime> {
  const runtime = await preflight();
  try {
    await requestFullscreen();
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
