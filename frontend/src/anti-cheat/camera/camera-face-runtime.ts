import {
  CAMERA_AI_CONFIG,
  CAMERA_FACE_DIAGNOSTICS,
  CAMERA_FALLBACK_FACE_MODEL,
  CAMERA_PRIMARY_FACE_MODEL,
  type ProductionCameraModel,
} from '../camera-ai.config';
import { TemporalIncidentFilter } from '../temporal-filter';
import type { CameraAiIncident } from '../anti-cheat.types';
import { PerformanceController } from '../performance-controller';
import type { CameraFaceDetectionResult, CameraFaceDetector } from './detectors/camera-face-detector';
import { MediaPipeFaceLandmarkerDetector } from './detectors/mediapipe-face-landmarker-detector';

type IncidentHandler = (incident: CameraAiIncident) => void;
type RuntimeErrorHandler = (error: Error) => void;

export interface CameraFaceRuntimeDependencies {
  primaryDetector?: CameraFaceDetector;
  fallbackDetector?: CameraFaceDetector;
  createPrimaryDetector?: () => Promise<CameraFaceDetector>;
  createFallbackDetector?: () => Promise<CameraFaceDetector>;
}

export class CameraFaceRuntime {
  private detector: CameraFaceDetector | null = null;
  private activeModel: ProductionCameraModel = CAMERA_PRIMARY_FACE_MODEL;
  private readonly primaryDetector: CameraFaceDetector | null;
  private readonly fallbackDetector: CameraFaceDetector | null;
  private readonly createPrimaryDetector: () => Promise<CameraFaceDetector>;
  private readonly createFallbackDetector: () => Promise<CameraFaceDetector>;
  private timer: number | null = null;
  private inferenceInFlight = false;
  private fallbackStarting = false;
  private stopped = false;
  private video: HTMLVideoElement | null = null;
  private readonly filter = new TemporalIncidentFilter();
  private readonly performance = new PerformanceController('face');
  private processedFrames = 0;
  private skippedFrames = 0;
  private incidents = 0;
  private lastResult: CameraFaceDetectionResult | null = null;
  private lastDiagnosticsAt = 0;
  private lastDiagnosticFrameCount = 0;

  constructor(
    private readonly stream: MediaStream,
    private onIncident: IncidentHandler,
    private readonly onRuntimeError: RuntimeErrorHandler = () => {},
    dependencies: CameraFaceRuntimeDependencies = {},
  ) {
    this.primaryDetector = dependencies.primaryDetector ?? null;
    this.fallbackDetector = dependencies.fallbackDetector ?? null;
    this.createPrimaryDetector = dependencies.createPrimaryDetector ?? (async () => {
      const { YuNetFaceDetector } = await import('./detectors/yunet-face-detector');
      return new YuNetFaceDetector();
    });
    this.createFallbackDetector = dependencies.createFallbackDetector ?? (async () => new MediaPipeFaceLandmarkerDetector());
  }

  setIncidentHandler(onIncident: IncidentHandler): void {
    this.onIncident = onIncident;
  }

  resetForAttemptStart(): void {
    this.filter.reset();
  }

  async start(): Promise<void> {
    const track = this.stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') throw new Error('A live camera track is required for camera analysis.');
    try {
      await this.activatePrimary();
    } catch (primaryError) {
      await this.activateFallback(primaryError);
    }
    if (this.stopped) return;

    this.video = document.createElement('video');
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    if (this.stopped) return;
    this.logDiagnostics('ready');
    this.schedule();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    void this.detector?.dispose();
    this.detector = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
  }

  private async activatePrimary(): Promise<void> {
    const detector = this.primaryDetector ?? await this.createPrimaryDetector();
    await detector.load();
    if (this.stopped) {
      await detector.dispose();
      return;
    }
    this.detector = detector;
    this.activeModel = CAMERA_PRIMARY_FACE_MODEL;
  }

  private async activateFallback(cause: unknown): Promise<void> {
    if (this.fallbackStarting || this.stopped) return;
    this.fallbackStarting = true;
    try {
      this.logFallback(cause);
      await this.detector?.dispose();
      this.detector = null;
      const fallback = this.fallbackDetector ?? await this.createFallbackDetector();
      await fallback.load();
      if (this.stopped) {
        await fallback.dispose();
        return;
      }
      this.detector = fallback;
      this.activeModel = CAMERA_FALLBACK_FACE_MODEL;
    } finally {
      this.fallbackStarting = false;
    }
  }

  private schedule(): void {
    if (this.stopped) return;
    this.timer = window.setTimeout(() => {
      void this.inferLatestFrame().finally(() => this.schedule());
    }, this.performance.nextDelayMs());
  }

  private async inferLatestFrame(): Promise<void> {
    if (this.stopped || this.fallbackStarting) return;
    if (this.inferenceInFlight) {
      this.skippedFrames += 1;
      return;
    }
    const track = this.stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') {
      this.onRuntimeError(new Error('The camera track is no longer live.'));
      return;
    }
    if (!this.video || !this.detector) return;

    this.inferenceInFlight = true;
    try {
      const result = await this.detector.detect(this.video, performance.now());
      this.performance.record(result.inferenceMs);
      this.processedFrames += 1;
      this.lastResult = result;
      this.handleObservation(result.faceCount);
    } catch (cause) {
      if (this.activeModel === CAMERA_PRIMARY_FACE_MODEL) {
        void this.activateFallback(cause).catch((fallbackError) => {
          if (!this.stopped) this.onRuntimeError(fallbackError instanceof Error ? fallbackError : new Error('Camera analysis stopped unexpectedly.'));
        });
      } else if (!this.stopped) {
        this.onRuntimeError(cause instanceof Error ? cause : new Error('Camera analysis stopped unexpectedly.'));
      }
    } finally {
      this.inferenceInFlight = false;
    }
  }

  private handleObservation(faceCount: number): void {
    const now = performance.now();
    const incidents = [
      this.filter.observe('NO_FACE_DETECTED', faceCount === 0, now, CAMERA_AI_CONFIG.noFaceDurationMs, {}),
      this.filter.observe('MULTIPLE_FACES_DETECTED', faceCount >= 2, now, CAMERA_AI_CONFIG.multipleFacesDurationMs, { faceCount }),
    ];
    incidents.forEach((incident) => {
      if (incident) {
        this.incidents += 1;
        this.onIncident(incident);
      }
    });
    this.logDiagnostics('running');
  }

  private logFallback(cause: unknown): void {
    if (!CAMERA_FACE_DIAGNOSTICS) return;
    console.warn('[AntiCheat camera] YuNet failed; starting MediaPipe fallback.', cause);
  }

  private logDiagnostics(status: 'ready' | 'running'): void {
    if (!CAMERA_FACE_DIAGNOSTICS) return;
    const now = performance.now();
    if (status === 'running' && now - this.lastDiagnosticsAt < 2_000) return;
    const elapsedMs = now - this.lastDiagnosticsAt;
    const faceAiFps = elapsedMs > 0
      ? (this.processedFrames - this.lastDiagnosticFrameCount) / (elapsedMs / 1_000)
      : 0;
    this.lastDiagnosticsAt = now;
    this.lastDiagnosticFrameCount = this.processedFrames;
    console.debug('[AntiCheat camera]', {
      status,
      activeModel: this.activeModel,
      faceCount: this.lastResult?.faceCount ?? 0,
      inferenceMs: this.lastResult?.inferenceMs ?? 0,
      executionProvider: this.detector?.executionProvider ?? null,
      faceAiFps: Math.round(faceAiFps * 10) / 10,
      adaptiveFpsTarget: this.performance.targetFps,
      processedFrames: this.processedFrames,
      skippedFrames: this.skippedFrames,
      incidents: this.incidents,
    });
  }
}
