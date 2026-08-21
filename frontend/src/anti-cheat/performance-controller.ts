import { CAMERA_AI_CONFIG } from './camera-ai.config';

export type InferenceKind = 'face' | 'object' | 'audio';

const FACE_FPS = [15, 10, 6, 4] as const;
const OBJECT_FPS = [2, 1, 0.5] as const;
const AUDIO_FPS = [1, 0.5, 0.25] as const;

export class PerformanceController {
  private averageMs = 0;

  constructor(private readonly kind: InferenceKind) {}

  record(durationMs: number): void {
    this.averageMs = this.averageMs === 0 ? durationMs : this.averageMs * 0.8 + durationMs * 0.2;
  }

  nextDelayMs(): number {
    const fps = this.targetFps;
    // Inference completes before the next timer is scheduled. Subtract its
    // moving average so the interval is measured start-to-start, not end-to-start.
    return Math.max(0, 1_000 / fps - this.averageMs);
  }

  get averageInferenceMs(): number {
    return this.averageMs;
  }

  get targetFps(): number {
    if (this.kind === 'face') {
      if (this.averageMs < 67) return Math.min(FACE_FPS[0], CAMERA_AI_CONFIG.mainThreadMaxFps);
      if (this.averageMs < 100) return Math.min(FACE_FPS[1], CAMERA_AI_CONFIG.mainThreadMaxFps);
      if (this.averageMs < 180) return Math.min(FACE_FPS[2], CAMERA_AI_CONFIG.mainThreadMaxFps);
      return Math.min(FACE_FPS[3], CAMERA_AI_CONFIG.mainThreadMaxFps);
    }
    if (this.kind === 'object') {
      if (this.averageMs < 300) return OBJECT_FPS[0];
      if (this.averageMs < 600) return OBJECT_FPS[1];
      return OBJECT_FPS[2];
    }
    if (this.averageMs < 500) return AUDIO_FPS[0];
    if (this.averageMs < 1_000) return AUDIO_FPS[1];
    return AUDIO_FPS[2];
  }
}
