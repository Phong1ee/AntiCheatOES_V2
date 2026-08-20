import { CAMERA_AI_CONFIG, FACE_LANDMARKER_MODEL_URL, FACE_LANDMARKER_WASM_URL } from '../../camera-ai.config';
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
    const faceCount = this.landmarker.detectForVideo(source, timestampMs).faceLandmarks.length;
    return { faceCount, predictedClass: classifyFaceCount(faceCount), inferenceMs: performance.now() - start };
  }

  dispose(): void { this.landmarker?.close(); this.landmarker = null; }
}
