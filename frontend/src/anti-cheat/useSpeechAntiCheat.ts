import { useEffect, useRef, useState } from 'react';
import type { CameraAiStatus } from './anti-cheat.types';
import type { IncidentReporter } from './incident-reporter';
import { MicrophoneVadRuntime } from './microphone-vad-runtime';

interface UseSpeechAntiCheatOptions {
  antiCheatEnabled: boolean;
  attemptStatus: string;
  attemptId: number | null;
  examId: string;
  mediaStream?: MediaStream;
  reporter: IncidentReporter;
  onUnavailable: (message: string) => void;
}

export function useSpeechAntiCheat({ antiCheatEnabled, attemptStatus, attemptId, examId: _examId, mediaStream, reporter, onUnavailable }: UseSpeechAntiCheatOptions): CameraAiStatus {
  const [status, setStatus] = useState<CameraAiStatus>('inactive');
  const callbacks = useRef({ onUnavailable });
  callbacks.current = { onUnavailable };

  useEffect(() => {
    const audioTrack = mediaStream?.getAudioTracks()[0];
    const active = antiCheatEnabled && attemptStatus === 'in_progress' && Boolean(attemptId) && audioTrack?.readyState === 'live';
    if (!active || !mediaStream || !attemptId || !audioTrack) {
      setStatus('inactive');
      return;
    }
    let disposed = false;
    let runtime: MicrophoneVadRuntime | null = null;
    const onTrackEnded = () => {
      runtime?.stop();
      if (!disposed) setStatus('inactive');
    };
    audioTrack.addEventListener('ended', onTrackEnded);
    setStatus('loading');
    runtime = new MicrophoneVadRuntime(mediaStream, (incident) => {
      void reporter.report({
        eventType: 'SPEECH_ACTIVITY_DETECTED',
        source: 'microphone',
        details: 'sustained human speech confirmed',
        metadata: incident,
      });
    });
    void runtime.start().then(() => {
      if (!disposed && audioTrack.readyState === 'live') setStatus('ready');
    }).catch((error: unknown) => {
      runtime?.stop();
      if (!disposed) {
        setStatus('unavailable');
        callbacks.current.onUnavailable(error instanceof Error ? error.message : 'Speech detection is unavailable.');
      }
    });
    return () => {
      disposed = true;
      audioTrack.removeEventListener('ended', onTrackEnded);
      runtime?.stop();
    };
  }, [antiCheatEnabled, attemptStatus, attemptId, mediaStream, reporter]);

  return status;
}
