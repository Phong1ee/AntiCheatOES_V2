import { useCallback, useEffect, useRef } from 'react';
import { studentExamService, type AntiCheatEventResult } from '../services/student-exam.service';

export interface AntiCheatIncident {
  eventType: string;
  source: 'browser' | 'camera' | 'microphone';
  details?: string;
  metadata?: Record<string, number | string | boolean>;
}

interface IncidentReporterOptions {
  active: boolean;
  examId: string;
  attemptId: number | null;
  onEvent: (event: AntiCheatEventResult, eventType: string) => void;
}

export interface IncidentReporter {
  report: (incident: AntiCheatIncident) => Promise<void>;
}

export function useIncidentReporter({ active, examId, attemptId, onEvent }: IncidentReporterOptions): IncidentReporter {
  const callbacks = useRef({ onEvent });
  const inFlight = useRef(new Set<string>());
  callbacks.current = { onEvent };

  useEffect(() => () => inFlight.current.clear(), [attemptId]);

  const report = useCallback(async (incident: AntiCheatIncident) => {
    if (!active || !attemptId) return;
    // Prevent a detector from racing the same incident while its prior request is pending.
    const key = `${incident.source}:${incident.eventType}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    try {
      const event = await studentExamService.recordAntiCheatEvent(
        examId,
        attemptId,
        incident.eventType,
        incident.source,
        incident.details,
        incident.metadata,
      );
      callbacks.current.onEvent(event, incident.eventType);
    } catch {
      // Attempt-session and heartbeat flows own request recovery.
    } finally {
      inFlight.current.delete(key);
    }
  }, [active, attemptId, examId]);

  return { report };
}
