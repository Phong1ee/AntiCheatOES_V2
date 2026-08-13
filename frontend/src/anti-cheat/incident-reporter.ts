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
    // Prevent a continuous detector from racing the same incident while its prior
    // request is pending. Browser events are discrete user actions, so each one is
    // its own violation and must never be dropped here; a repeat would otherwise be
    // lost for as long as the previous request is pending or retrying. Their burst
    // suppression already lives in useAntiCheatMonitoring.
    const deduped = incident.source !== 'browser';
    const key = `${incident.source}:${incident.eventType}`;
    if (deduped) {
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);
    }
    const release = () => { if (deduped) inFlight.current.delete(key); };
    const clientEventId = window.crypto.randomUUID();
    const send = async (retry = 0): Promise<void> => {
      try {
        const event = await studentExamService.recordAntiCheatEvent(examId, attemptId, clientEventId, incident.eventType, incident.source, incident.details, incident.metadata);
        callbacks.current.onEvent(event, incident.eventType);
        release();
      } catch (error) {
        const status = error instanceof ApiError ? error.status : undefined;
        const transient = !status || status >= 500 || status === 408 || status === 429;
        if (!transient || retry >= 2 || !active) {
          release();
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
