import type { AntiCheatIncident } from '../incident-reporter';
import { MicrophoneVadRuntime } from '../microphone-vad-runtime';
import { OVERLAP_DETECTOR_CONFIG } from './overlap-detector.config';
import { OverlapDetector } from './overlap-detector';

export class AudioAntiCheatRuntime {
  private readonly overlap: OverlapDetector;
  private readonly vad: MicrophoneVadRuntime;
  private incidentCommittedUntil = 0;

  constructor(
    stream: MediaStream,
    private readonly onIncident: (incident: AntiCheatIncident) => void,
    private readonly onRuntimeError: (error: Error) => void = () => {},
  ) {
    this.overlap = new OverlapDetector((incident) => {
      if (performance.now() < this.incidentCommittedUntil) return;
      this.incidentCommittedUntil = performance.now() + OVERLAP_DETECTOR_CONFIG.cooldownMs;
      this.logCoordinator('MULTIPLE_VOICES_DETECTED');
      const details = incident.detectionMode === 'overlap'
        ? 'sustained overlapping voices confirmed'
        : 'sustained alternating speaker turns confirmed';
      this.onIncident({ eventType: 'MULTIPLE_VOICES_DETECTED', source: 'microphone', details, metadata: incident });
    }, this.onRuntimeError);
    this.vad = new MicrophoneVadRuntime(
      stream,
      (probability, frame) => this.overlap.observeVadFrame(probability, frame),
      () => this.overlap.analyzeNow(),
      this.onRuntimeError,
    );
  }

  async start(): Promise<void> { await this.overlap.start(); await this.vad.start(); }

  resetForAttemptStart(): void {
    this.incidentCommittedUntil = 0;
    this.vad.resetForAttemptStart();
    this.overlap.resetForAttemptStart();
  }

  stop(): void { this.vad.stop(); this.overlap.stop(); }

  private logCoordinator(eventType: string): void {
    if (!import.meta.env.DEV) return;
    console.debug('[AntiCheat audio coordinator]', {
      eventType,
      cooldownMs: OVERLAP_DETECTOR_CONFIG.cooldownMs,
    });
  }
}
