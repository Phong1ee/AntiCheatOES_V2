import { useCallback, useEffect, useRef, useState } from 'react';
import { AntiCheatRuntime } from './anti-cheat-runtime';
import type { IncidentReporter } from './incident-reporter';

export type AiReadiness = 'inactive' | 'loading' | 'ready' | 'error';

interface UseAIAntiCheatOptions {
  active: boolean;
  mediaStream?: MediaStream;
  reporter: IncidentReporter;
}

export function useAIAntiCheat({ active, mediaStream, reporter }: UseAIAntiCheatOptions) {
  const [readiness, setReadiness] = useState<AiReadiness>('inactive');
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const runtimeRef = useRef<AntiCheatRuntime | null>(null);
  const { report } = reporter;

  const stop = useCallback(() => {
    runtimeRef.current?.stop();
    runtimeRef.current = null;
  }, []);

  const retry = useCallback(() => setRetryNonce((value) => value + 1), []);

  useEffect(() => {
    const videoTrack = mediaStream?.getVideoTracks()[0];
    const audioTrack = mediaStream?.getAudioTracks()[0];
    if (!active) {
      stop();
      setReadiness('inactive');
      setError(null);
      return;
    }
    if (!mediaStream || videoTrack?.readyState !== 'live' || audioTrack?.readyState !== 'live') {
      stop();
      setReadiness('error');
      setError('A live camera and microphone are required for anti-cheat analysis.');
      return;
    }

    let disposed = false;
    const runtime = new AntiCheatRuntime(mediaStream, (incident) => void report(incident));
    runtimeRef.current = runtime;
    setReadiness('loading');
    setError(null);
    void runtime.start().then(() => {
      if (!disposed) setReadiness('ready');
    }).catch((cause: unknown) => {
      if (!disposed) {
        setReadiness('error');
        setError(cause instanceof Error ? cause.message : 'Anti-cheat analysis could not be initialized.');
      }
    });

    return () => {
      disposed = true;
      runtime.stop();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [active, mediaStream, report, retryNonce, stop]);

  return { readiness, error, retry, stop };
}
