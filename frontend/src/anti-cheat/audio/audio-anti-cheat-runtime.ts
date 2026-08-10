import type { AntiCheatIncident } from '../incident-reporter';
import { MicrophoneVadRuntime } from '../microphone-vad-runtime';
import { OVERLAP_DETECTOR_CONFIG } from './overlap-detector.config';
import { OverlapDetector } from './overlap-detector';

export class AudioAntiCheatRuntime {
  private readonly overlap: OverlapDetector;
  private readonly vad: MicrophoneVadRuntime;
  private pendingSpeech: number | null = null;
  private incidentCommittedUntil = 0;
  private stopped = false;
  private pendingSpeechAt: number | null = null;

  constructor(
    stream: MediaStream,
    private readonly onIncident: (incident: AntiCheatIncident) => void,
    private readonly onRuntimeError: (error: Error) => void = () => {},
  ) {
    this.overlap = new OverlapDetector((incident) => {
      if (performance.now() < this.incidentCommittedUntil) return;
      if (this.pendingSpeech) { window.clearTimeout(this.pendingSpeech); this.pendingSpeech = null; }
      const now = performance.now();
      this.incidentCommittedUntil = performance.now() + OVERLAP_DETECTOR_CONFIG.cooldownMs;
      this.logCoordinator('MULTIPLE_VOICES_DETECTED', now);
      this.onIncident({ eventType: 'MULTIPLE_VOICES_DETECTED', source: 'microphone', details: 'sustained overlapping voices confirmed', metadata: incident });
    }, this.onRuntimeError);
    this.vad = new MicrophoneVadRuntime(
      stream,
      (incident) => this.deferSpeechIncident(incident),
      (probability, frame) => this.overlap.observeVadFrame(probability, frame),
      () => this.overlap.analyzeNow(),
      this.onRuntimeError,
    );
  }

  async start(): Promise<void> { await this.overlap.start(); await this.vad.start(); }

  resetForAttemptStart(): void {
    if (this.pendingSpeech) window.clearTimeout(this.pendingSpeech);
    this.pendingSpeech = null;
    this.pendingSpeechAt = null;
    this.incidentCommittedUntil = 0;
    this.vad.resetForAttemptStart();
    this.overlap.resetForAttemptStart();
  }

  private deferSpeechIncident(incident: { durationMs: number; speechProbability: number }): void {
    if (this.pendingSpeech || this.stopped) return;
    // One bounded adjudication window gives the just-triggered overlap inference priority.
    this.pendingSpeechAt = performance.now();
    this.pendingSpeech = window.setTimeout(() => {
      this.pendingSpeech = null;
      if (performance.now() < this.incidentCommittedUntil) return;
      this.incidentCommittedUntil = performance.now() + OVERLAP_DETECTOR_CONFIG.cooldownMs;
      this.logCoordinator('SPEECH_ACTIVITY_DETECTED', performance.now());
      this.onIncident({ eventType: 'SPEECH_ACTIVITY_DETECTED', source: 'microphone', details: 'sustained human speech confirmed', metadata: incident });
    }, OVERLAP_DETECTOR_CONFIG.speechDecisionDelayMs);
  }

  stop(): void { this.stopped = true; if (this.pendingSpeech) window.clearTimeout(this.pendingSpeech); this.pendingSpeech = null; this.pendingSpeechAt = null; this.vad.stop(); this.overlap.stop(); }

  private logCoordinator(eventType: string, now: number): void {
    if (!import.meta.env.DEV) return;
    console.debug('[AntiCheat audio coordinator]', {
      eventType,
      classificationWaitMs: this.pendingSpeechAt === null ? 0 : Math.round(now - this.pendingSpeechAt),
      cooldownMs: OVERLAP_DETECTOR_CONFIG.cooldownMs,
    });
    this.pendingSpeechAt = null;
  }
}
