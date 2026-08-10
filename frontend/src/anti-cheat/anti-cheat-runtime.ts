import { CameraFaceRuntime } from './camera/camera-face-runtime';
import { AudioAntiCheatRuntime } from './audio/audio-anti-cheat-runtime';
import type { AntiCheatIncident } from './incident-reporter';

export class AntiCheatRuntime {
  private readonly camera: CameraFaceRuntime;
  private readonly microphone: AudioAntiCheatRuntime;
  private stopped = false;
  private runtimeError: Error | null = null;
  private onIncident: (incident: AntiCheatIncident) => void;
  private onRuntimeError: (error: Error) => void;

  constructor(
    stream: MediaStream,
    onIncident: (incident: AntiCheatIncident) => void = () => {},
    onRuntimeError: (error: Error) => void = () => {},
  ) {
    this.onIncident = onIncident;
    this.onRuntimeError = onRuntimeError;
    this.camera = new CameraFaceRuntime(stream, (incident) => this.onIncident({
      ...incident,
      source: 'camera',
    }), (error) => this.fail(error));
    this.microphone = new AudioAntiCheatRuntime(stream, (incident) => this.onIncident(incident), (error) => this.fail(error));
  }

  async start(): Promise<void> {
    try {
      await Promise.all([this.camera.start(), this.microphone.start()]);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.camera.stop();
    this.microphone.stop();
  }

  setIncidentHandler(onIncident: (incident: AntiCheatIncident) => void): void {
    this.onIncident = onIncident;
    this.camera.setIncidentHandler((incident) => this.onIncident({ ...incident, source: 'camera' }));
  }

  setRuntimeErrorHandler(onRuntimeError: (error: Error) => void): void {
    this.onRuntimeError = onRuntimeError;
    if (this.runtimeError) onRuntimeError(this.runtimeError);
  }

  // Preflight has no attempt yet, so discard any detector evidence collected there.
  resetForAttemptStart(): void {
    this.camera.resetForAttemptStart();
    this.microphone.resetForAttemptStart();
  }

  hasRuntimeError(): boolean {
    return this.runtimeError !== null;
  }

  private fail(cause: unknown): void {
    if (this.stopped || this.runtimeError) return;
    this.runtimeError = cause instanceof Error ? cause : new Error('Anti-cheat monitoring was interrupted.');
    this.stop();
    this.onRuntimeError(this.runtimeError);
  }
}
