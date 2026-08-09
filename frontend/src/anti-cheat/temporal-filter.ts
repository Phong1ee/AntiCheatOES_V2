import { CAMERA_AI_CONFIG } from './camera-ai.config';
import type { CameraAiIncident, CameraAiEventType } from './anti-cheat.types';

interface EventState {
  activeSince: number | null;
  lastEmittedAt: number | null;
}

export class TemporalIncidentFilter {
  private readonly states = new Map<CameraAiEventType, EventState>();

  observe(
    eventType: CameraAiEventType,
    active: boolean,
    now: number,
    durationMs: number,
    metadata: Record<string, number>,
  ): CameraAiIncident | null {
    const state = this.states.get(eventType) ?? { activeSince: null, lastEmittedAt: null };
    this.states.set(eventType, state);
    if (!active) {
      state.activeSince = null;
      return null;
    }
    if (state.activeSince === null) state.activeSince = now;
    const observedDuration = now - state.activeSince;
    const coolingDown = state.lastEmittedAt !== null && now - state.lastEmittedAt < CAMERA_AI_CONFIG.incidentCooldownMs;
    if (observedDuration < durationMs || coolingDown) return null;

    state.lastEmittedAt = now;
    state.activeSince = now;
    return {
      eventType,
      details: `${eventType.replaceAll('_', ' ').toLowerCase()} confirmed`,
      metadata: { ...metadata, durationMs: observedDuration },
    };
  }
}
