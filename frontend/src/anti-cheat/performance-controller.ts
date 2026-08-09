export type InferenceKind = 'face' | 'object';

const FACE_FPS = [5, 4, 3, 2] as const;
const OBJECT_FPS = [2, 1, 0.5] as const;

export class PerformanceController {
  private averageMs = 0;

  constructor(private readonly kind: InferenceKind) {}

  record(durationMs: number): void {
    this.averageMs = this.averageMs === 0 ? durationMs : this.averageMs * 0.8 + durationMs * 0.2;
  }

  nextDelayMs(): number {
    const fps = this.targetFps();
    return Math.max(0, 1_000 / fps);
  }

  private targetFps(): number {
    if (this.kind === 'face') {
      if (this.averageMs < 120) return FACE_FPS[0];
      if (this.averageMs < 220) return FACE_FPS[1];
      if (this.averageMs < 350) return FACE_FPS[2];
      return FACE_FPS[3];
    }
    if (this.averageMs < 300) return OBJECT_FPS[0];
    if (this.averageMs < 600) return OBJECT_FPS[1];
    return OBJECT_FPS[2];
  }
}
