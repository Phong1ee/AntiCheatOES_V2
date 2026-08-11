import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { CAMERA_AI_CONFIG, FACE_LANDMARKER_MODEL_URL, FACE_LANDMARKER_WASM_URL } from '../camera-ai.config';
import { TemporalIncidentFilter } from '../temporal-filter';
import type { CameraAiIncident } from '../anti-cheat.types';
import { PerformanceController } from '../performance-controller';
import { analyzeFaceLandmarks } from './face-analyzer';

type IncidentHandler = (incident: CameraAiIncident) => void;
type RuntimeErrorHandler = (error: Error) => void;

export class CameraFaceRuntime {
  private landmarker: FaceLandmarker | null = null;
  private timer: number | null = null;
  private inferenceInFlight = false;
  private stopped = false;
  private video: HTMLVideoElement | null = null;
  private readonly filter = new TemporalIncidentFilter();
  private readonly performance = new PerformanceController('face');
  private smoothedYaw: number | null = null;
  private smoothedPitch: number | null = null;
  private smoothedGaze: number | null = null;
  private processedFrames = 0;
  private skippedFrames = 0;
  private lastDiagnosticsAt = 0;
  private lastDiagnosticFrameCount = 0;

  constructor(
    private readonly stream: MediaStream,
    private onIncident: IncidentHandler,
    private readonly onRuntimeError: RuntimeErrorHandler = () => {},
  ) {}

  setIncidentHandler(onIncident: IncidentHandler): void {
    this.onIncident = onIncident;
  }

  resetForAttemptStart(): void {
    this.filter.reset();
    this.smoothedYaw = null;
    this.smoothedPitch = null;
    this.smoothedGaze = null;
  }

  async start(): Promise<void> {
    const track = this.stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') throw new Error('A live camera track is required for camera analysis.');
    // Dynamic import keeps the MediaPipe runtime and remote task model out of disabled exams.
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM_URL);
    if (this.stopped) return;
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL },
      runningMode: 'VIDEO',
      numFaces: 2,
      minFaceDetectionConfidence: CAMERA_AI_CONFIG.minFaceDetectionConfidence,
      minFacePresenceConfidence: CAMERA_AI_CONFIG.minFacePresenceConfidence,
      minTrackingConfidence: CAMERA_AI_CONFIG.minTrackingConfidence,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    if (this.stopped) {
      this.landmarker.close();
      this.landmarker = null;
      return;
    }
    this.video = document.createElement('video');
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    this.logDiagnostics('ready', { faceCount: 0, yaw: 0, pitch: 0, gazeOffset: null });
    this.schedule();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.landmarker?.close();
    this.landmarker = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
  }

  private schedule(): void {
    if (this.stopped) return;
    this.timer = window.setTimeout(() => {
      void this.inferLatestFrame().finally(() => this.schedule());
    }, this.performance.nextDelayMs());
  }

  private async inferLatestFrame(): Promise<void> {
    if (this.stopped) return;
    if (this.inferenceInFlight) {
      this.skippedFrames += 1;
      return;
    }
    const track = this.stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') {
      this.onRuntimeError(new Error('The camera track is no longer live.'));
      return;
    }
    if (!this.landmarker) return;
    this.inferenceInFlight = true;
    try {
      if (this.stopped || !this.landmarker || !this.video) return;
      const startedAt = performance.now();
      const result = this.landmarker.detectForVideo(this.video, performance.now());
      this.performance.record(performance.now() - startedAt);
      this.processedFrames += 1;
      this.handleObservation(this.smoothObservation(analyzeFaceLandmarks(result.faceLandmarks)));
    } catch (cause) {
      if (!this.stopped) this.onRuntimeError(cause instanceof Error ? cause : new Error('Camera analysis stopped unexpectedly.'));
    } finally {
      this.inferenceInFlight = false;
    }
  }

  private handleObservation(observation: ReturnType<typeof analyzeFaceLandmarks>): void {
    const now = performance.now();
    // Head/gaze-away detection was unreliable (frequent false positives) and no
    // longer counts as a violation; only face presence/count is enforced.
    const incidents = [
      this.filter.observe('NO_FACE_DETECTED', observation.faceCount === 0, now, CAMERA_AI_CONFIG.noFaceDurationMs, {}),
      this.filter.observe('MULTIPLE_FACES_DETECTED', observation.faceCount >= 2, now, CAMERA_AI_CONFIG.multipleFacesDurationMs, { faceCount: observation.faceCount }),
    ];
    incidents.forEach((incident) => { if (incident) this.onIncident(incident); });
    this.logDiagnostics('running', observation);
  }

  private smoothObservation(observation: ReturnType<typeof analyzeFaceLandmarks>): ReturnType<typeof analyzeFaceLandmarks> {
    if (observation.faceCount !== 1) {
      this.smoothedYaw = null;
      this.smoothedPitch = null;
      this.smoothedGaze = null;
      return observation;
    }

    const smooth = (previous: number | null, value: number) => previous === null
      ? value
      : previous + CAMERA_AI_CONFIG.smoothingAlpha * (value - previous);
    this.smoothedYaw = smooth(this.smoothedYaw, observation.yaw);
    this.smoothedPitch = smooth(this.smoothedPitch, observation.pitch);
    this.smoothedGaze = observation.gazeOffset === null ? null : smooth(this.smoothedGaze, observation.gazeOffset);
    const headAway = Math.abs(this.smoothedYaw) >= CAMERA_AI_CONFIG.headYawDegrees
      || Math.abs(this.smoothedPitch) >= CAMERA_AI_CONFIG.headPitchDegrees;
    const gazeAway = !headAway && this.smoothedGaze !== null && Math.abs(this.smoothedGaze) >= CAMERA_AI_CONFIG.gazeOffset;
    return { ...observation, yaw: this.smoothedYaw, pitch: this.smoothedPitch, gazeOffset: this.smoothedGaze, headAway, gazeAway };
  }

  private logDiagnostics(status: 'ready' | 'running', observation: ReturnType<typeof analyzeFaceLandmarks>): void {
    if (!import.meta.env.DEV) return;
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
      workerMode: 'no',
      faceAiFps: Math.round(faceAiFps * 10) / 10,
      adaptiveFpsTarget: this.performance.targetFps,
      averageInferenceMs: Math.round(this.performance.averageInferenceMs),
      skippedFrames: this.skippedFrames,
      processedFrames: this.processedFrames,
      faceCount: observation.faceCount,
      yaw: Math.round(observation.yaw * 10) / 10,
      pitch: Math.round(observation.pitch * 10) / 10,
      gazeOffset: observation.gazeOffset === null ? null : Math.round(observation.gazeOffset * 100) / 100,
    });
  }
}
