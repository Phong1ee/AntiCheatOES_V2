import { useEffect, useRef, useState } from 'react';
import { CameraFaceRuntime } from './camera/camera-face-runtime';
import type { IncidentReporter } from './incident-reporter';
import type { CameraAiIncident, CameraAiStatus } from './anti-cheat.types';

interface UseCameraAntiCheatOptions {
  antiCheatEnabled: boolean;
  attemptStatus: string;
  attemptId: number | null;
  examId: string;
  mediaStream?: MediaStream;
  reporter: IncidentReporter;
  onUnavailable: (message: string) => void;
}

export function useCameraAntiCheat({ antiCheatEnabled, attemptStatus, attemptId, examId: _examId, mediaStream, reporter, onUnavailable }: UseCameraAntiCheatOptions): CameraAiStatus {
  const [status, setStatus] = useState<CameraAiStatus>('inactive');
  const latestCallbacks = useRef({ onUnavailable });
  latestCallbacks.current = { onUnavailable };

  useEffect(() => {
    const videoTrack = mediaStream?.getVideoTracks()[0];
    const active = antiCheatEnabled && attemptStatus === 'in_progress' && Boolean(attemptId) && videoTrack?.readyState === 'live';
    if (!active || !mediaStream || !attemptId || !videoTrack) {
      setStatus('inactive');
      return;
    }

    let disposed = false;
    let runtime: CameraFaceRuntime | null = null;
    const reportIncident = (incident: CameraAiIncident) => void reporter.report({ ...incident, source: 'camera' });
    const onTrackEnded = () => {
      runtime?.stop();
      if (!disposed) setStatus('inactive');
    };
    videoTrack.addEventListener('ended', onTrackEnded);
    setStatus('loading');
    runtime = new CameraFaceRuntime(mediaStream, (incident) => void reportIncident(incident));
    void runtime.start().then(() => {
      if (!disposed && videoTrack.readyState === 'live') setStatus('ready');
    }).catch((error: unknown) => {
      runtime?.stop();
      if (!disposed) {
        setStatus('unavailable');
        latestCallbacks.current.onUnavailable(error instanceof Error ? error.message : 'Camera AI is unavailable.');
      }
    });
    return () => {
      disposed = true;
      videoTrack.removeEventListener('ended', onTrackEnded);
      runtime?.stop();
    };
  }, [antiCheatEnabled, attemptStatus, attemptId, mediaStream, reporter]);

  return status;
}
