import { useCallback, useEffect, useRef, useState } from 'react';
import { AntiCheatRuntime } from './anti-cheat-runtime';
import type { IncidentReporter } from './incident-reporter';

export type AiReadiness = 'inactive' | 'loading' | 'ready' | 'error';

interface UseAIAntiCheatOptions {
  active: boolean;
  mediaStream?: MediaStream;
  reporter: IncidentReporter;
  preloadedRuntime?: AntiCheatRuntime;
  requiresCamera: boolean;
  requiresMicrophone: boolean;
}

export function useAIAntiCheat({ active, mediaStream, reporter, preloadedRuntime, requiresCamera, requiresMicrophone }: UseAIAntiCheatOptions) {
  const [readiness, setReadiness] = useState<AiReadiness>('inactive');
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const runtimeRef = useRef<AntiCheatRuntime | null>(null);
  const { report } = reporter;

  const stop = useCallback(() => {
    runtimeRef.current?.stop();
    runtimeRef.current = null;
  }, []);

  // React cleanup is not guaranteed to complete during a hard page reload.
  // Stop the worker/VAD synchronously on pagehide so the next Resume cannot
  // receive a late incident from the old microphone session.
  useEffect(() => {
    if (!active) return;
    const stopForPageExit = () => stop();
    window.addEventListener('pagehide', stopForPageExit);
    return () => window.removeEventListener('pagehide', stopForPageExit);
  }, [active, stop]);

  const fail = useCallback((message: string) => {
    stop();
    setReadiness('error');
    setError(message);
  }, [stop]);

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
    if (!mediaStream || (requiresCamera && videoTrack?.readyState !== 'live') || (requiresMicrophone && audioTrack?.readyState !== 'live')) {
      stop();
      setReadiness('error');
      setError(requiresCamera && requiresMicrophone ? 'A live camera and microphone are required for anti-cheat analysis.' : requiresCamera ? 'A live camera is required for anti-cheat analysis.' : 'A live microphone is required for anti-cheat analysis.');
      return;
    }

    let disposed = false;
    // A runtime created during preflight has already proved every required model.
    const runtime = preloadedRuntime && retryNonce === 0
      ? preloadedRuntime
      : new AntiCheatRuntime(mediaStream, undefined, undefined, { camera: requiresCamera, microphone: requiresMicrophone });
    runtimeRef.current = runtime;
    // A newly constructed runtime and a transferred preflight runtime both
    // begin this mounted exam session from a clean microphone evidence window.
    runtime.resetForAttemptStart();
    runtime.setIncidentHandler((incident) => void report(incident));
    runtime.setRuntimeErrorHandler((cause) => {
      if (!disposed) {
        setReadiness('error');
        setError(cause.message || 'Anti-cheat monitoring was interrupted.');
      }
    });
    if (runtime.hasRuntimeError()) return () => {
      disposed = true;
      runtime.stop();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
    setReadiness(preloadedRuntime && retryNonce === 0 ? 'ready' : 'loading');
    setError(null);
    if (preloadedRuntime && retryNonce === 0) return () => {
      disposed = true;
      runtime.stop();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
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
  }, [active, mediaStream, preloadedRuntime, report, requiresCamera, requiresMicrophone, retryNonce, stop]);

  return { readiness, error, retry, stop, fail };
}
