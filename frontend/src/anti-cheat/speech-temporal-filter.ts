import { MICROPHONE_AI_CONFIG } from './microphone-ai.config';

export interface SpeechIncident {
  durationMs: number;
  speechProbability: number;
}

export class SpeechTemporalFilter {
  private speechStartedAt: number | null = null;
  private lastPositiveAt: number | null = null;
  private lastIncidentAt: number | null = null;

  observe(speechProbability: number, now: number): SpeechIncident | null {
    if (speechProbability >= MICROPHONE_AI_CONFIG.positiveSpeechThreshold) {
      if (this.speechStartedAt === null) this.speechStartedAt = now;
      this.lastPositiveAt = now;
      const durationMs = now - this.speechStartedAt;
      const coolingDown = this.lastIncidentAt !== null && now - this.lastIncidentAt < MICROPHONE_AI_CONFIG.cooldownMs;
      if (durationMs >= MICROPHONE_AI_CONFIG.minimumSpeechDurationMs && !coolingDown) {
        this.lastIncidentAt = now;
        this.speechStartedAt = now;
        return { durationMs, speechProbability };
      }
      return null;
    }
    if (
      speechProbability <= MICROPHONE_AI_CONFIG.negativeSpeechThreshold
      && this.lastPositiveAt !== null
      && now - this.lastPositiveAt >= MICROPHONE_AI_CONFIG.silenceRedemptionMs
    ) {
      this.speechStartedAt = null;
      this.lastPositiveAt = null;
    }
    return null;
  }

  reset(): void {
    this.speechStartedAt = null;
    this.lastPositiveAt = null;
  }
}
