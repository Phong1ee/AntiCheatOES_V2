import { BLAZEFACE_SHORT_MODEL_URL, FACE_LANDMARKER_WASM_URL } from '../../camera-ai.config';
import { classifyFaceCount, type CameraFaceDetectionResult, type CameraFaceDetector } from './camera-face-detector';

export class BlazeFaceShortDetector implements CameraFaceDetector {
  readonly id = 'blazeface_short';
  readonly displayName = 'BlazeFace Short';
  readonly executionProvider = 'MediaPipe WASM';
  private detector: import('@mediapipe/tasks-vision').FaceDetector | null = null;
  async load(): Promise<void> { const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision'); const vision = await FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM_URL); this.detector = await FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: BLAZEFACE_SHORT_MODEL_URL }, runningMode: 'VIDEO', minDetectionConfidence: .5 }); }
  async detect(source: CanvasImageSource, timestampMs: number): Promise<CameraFaceDetectionResult> { if (!this.detector) throw new Error('BlazeFace Short has not loaded.'); const start = performance.now(); const faceCount = this.detector.detectForVideo(source, timestampMs).detections.length; return { faceCount, predictedClass: classifyFaceCount(faceCount), inferenceMs: performance.now() - start }; }
  dispose(): void { this.detector?.close(); this.detector = null; }
}
