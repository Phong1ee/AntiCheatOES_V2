import { CameraFaceRuntime } from './camera/camera-face-runtime';
import { MicrophoneVadRuntime } from './microphone-vad-runtime';
import type { AntiCheatIncident } from './incident-reporter';

export class AntiCheatRuntime {
  private readonly camera: CameraFaceRuntime;
  private readonly microphone: MicrophoneVadRuntime;
  private stopped = false;

  constructor(stream: MediaStream, onIncident: (incident: AntiCheatIncident) => void) {
    this.camera = new CameraFaceRuntime(stream, (incident) => onIncident({
      ...incident,
      source: 'camera',
    }));
    this.microphone = new MicrophoneVadRuntime(stream, (incident) => onIncident({
      eventType: 'SPEECH_ACTIVITY_DETECTED',
      source: 'microphone',
      details: 'sustained human speech confirmed',
      metadata: incident,
    }));
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
}
