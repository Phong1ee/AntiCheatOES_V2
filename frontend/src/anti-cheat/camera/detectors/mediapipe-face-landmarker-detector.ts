import { CAMERA_AI_CONFIG, FACE_LANDMARKER_MODEL_URL, FACE_LANDMARKER_WASM_URL } from '../../camera-ai.config';
import { analyzeFaceLandmarks } from '../face-analyzer';
import { classifyFaceCount, type CameraFaceDetectionResult, type CameraFaceDetector } from './camera-face-detector';

export class MediaPipeFaceLandmarkerDetector implements CameraFaceDetector {
  readonly id = 'face_landmarker';
  readonly displayName = 'Face Landmarker';
  readonly executionProvider = 'MediaPipe WASM';
  private landmarker: import('@mediapipe/tasks-vision').FaceLandmarker | null = null;

  async load(): Promise<void> {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM_URL);
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL }, runningMode: 'VIDEO', numFaces: 2,
      minFaceDetectionConfidence: CAMERA_AI_CONFIG.minFaceDetectionConfidence,
      minFacePresenceConfidence: CAMERA_AI_CONFIG.minFacePresenceConfidence,
      minTrackingConfidence: CAMERA_AI_CONFIG.minTrackingConfidence,
    });
  }

  async detect(source: CanvasImageSource, timestampMs: number): Promise<CameraFaceDetectionResult> {
    if (!this.landmarker) throw new Error('Face Landmarker has not loaded.');
    const start = performance.now();
    const observation = analyzeFaceLandmarks(this.landmarker.detectForVideo(source, timestampMs).faceLandmarks);
    return {
      faceCount: observation.faceCount,
      predictedClass: classifyFaceCount(observation.faceCount),
      inferenceMs: performance.now() - start,
      observation,
    };
  }

  dispose(): void { this.landmarker?.close(); this.landmarker = null; }
}
