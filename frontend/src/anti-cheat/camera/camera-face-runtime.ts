import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { CAMERA_AI_CONFIG, FACE_LANDMARKER_MODEL_URL, FACE_LANDMARKER_WASM_URL } from '../camera-ai.config';
import { TemporalIncidentFilter } from '../temporal-filter';
import type { CameraAiIncident } from '../anti-cheat.types';
import { PerformanceController } from '../performance-controller';
import { analyzeFaceLandmarks } from './face-analyzer';

type IncidentHandler = (incident: CameraAiIncident) => void;

export class CameraFaceRuntime {
  private landmarker: FaceLandmarker | null = null;
  private timer: number | null = null;
  private inferenceInFlight = false;
  private stopped = false;
  private video: HTMLVideoElement | null = null;
  private readonly filter = new TemporalIncidentFilter();
  private readonly performance = new PerformanceController('face');

  constructor(private readonly stream: MediaStream, private readonly onIncident: IncidentHandler) {}

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
      numFaces: 3,
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
    if (this.stopped || this.inferenceInFlight) return;
    const track = this.stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live' || !this.landmarker) return;
    this.inferenceInFlight = true;
    try {
      if (this.stopped || !this.landmarker || !this.video) return;
      const startedAt = performance.now();
      const result = this.landmarker.detectForVideo(this.video, performance.now());
      this.performance.record(performance.now() - startedAt);
      this.handleObservation(analyzeFaceLandmarks(result.faceLandmarks));
    } finally {
      this.inferenceInFlight = false;
    }
  }

  private handleObservation(observation: ReturnType<typeof analyzeFaceLandmarks>): void {
    const now = performance.now();
    const incidents = [
      this.filter.observe('NO_FACE_DETECTED', observation.faceCount === 0, now, CAMERA_AI_CONFIG.noFaceDurationMs, {}),
      this.filter.observe('MULTIPLE_FACES_DETECTED', observation.faceCount >= 2, now, CAMERA_AI_CONFIG.multipleFacesDurationMs, { faceCount: observation.faceCount }),
      this.filter.observe('HEAD_AWAY_SUSTAINED', observation.headAway, now, CAMERA_AI_CONFIG.headAwayDurationMs, { yaw: observation.yaw, pitch: observation.pitch }),
      this.filter.observe('GAZE_AWAY_SUSTAINED', observation.gazeAway, now, CAMERA_AI_CONFIG.gazeAwayDurationMs, { yaw: observation.yaw, pitch: observation.pitch }),
    ];
    incidents.forEach((incident) => { if (incident) this.onIncident(incident); });
  }
}
