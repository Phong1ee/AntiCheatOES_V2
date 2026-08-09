import { CameraFaceRuntime } from './camera/camera-face-runtime';
import { AudioAntiCheatRuntime } from './audio/audio-anti-cheat-runtime';
import type { AntiCheatIncident } from './incident-reporter';

export class AntiCheatRuntime {
  private readonly camera: CameraFaceRuntime;
  private readonly microphone: AudioAntiCheatRuntime;
  private stopped = false;

  constructor(stream: MediaStream, onIncident: (incident: AntiCheatIncident) => void) {
    this.camera = new CameraFaceRuntime(stream, (incident) => onIncident({
      ...incident,
      source: 'camera',
    }));
    this.microphone = new AudioAntiCheatRuntime(stream, onIncident);
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
