import { useCallback, useEffect, useRef } from 'react';
import { studentExamService, type AntiCheatEventResult } from '../services/student-exam.service';
import { ApiError } from '../services/api-error';

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
  const retryTimers = useRef(new Map<string, number>());
  callbacks.current = { onEvent };

  useEffect(() => () => {
    retryTimers.current.forEach((timer) => window.clearTimeout(timer));
    retryTimers.current.clear();
    inFlight.current.clear();
  }, [active, attemptId]);

  const report = useCallback(async (incident: AntiCheatIncident) => {
    if (!active || !attemptId) return;
    // Prevent a detector from racing the same incident while its prior request is pending.
    const key = `${incident.source}:${incident.eventType}`;
    if (inFlight.current.has(key)) return;
    const clientEventId = window.crypto.randomUUID();
    inFlight.current.add(key);
    const send = async (retry = 0): Promise<void> => {
      try {
        const event = await studentExamService.recordAntiCheatEvent(examId, attemptId, clientEventId, incident.eventType, incident.source, incident.details, incident.metadata);
        callbacks.current.onEvent(event, incident.eventType);
        inFlight.current.delete(key);
      } catch (error) {
        const status = error instanceof ApiError ? error.status : undefined;
        const transient = !status || status >= 500 || status === 408 || status === 429;
        if (!transient || retry >= 2 || !active) {
          inFlight.current.delete(key);
          return;
        }
        const delay = retry === 0 ? 500 : 1_500;
        const timer = window.setTimeout(() => {
          retryTimers.current.delete(clientEventId);
          void send(retry + 1);
        }, delay);
        retryTimers.current.set(clientEventId, timer);
      }
    };
    await send();
  }, [active, attemptId, examId]);

  return { report };
}
