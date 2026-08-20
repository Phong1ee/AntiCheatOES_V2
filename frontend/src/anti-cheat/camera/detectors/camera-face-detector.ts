export type FaceCountClass = 'NO_FACE' | 'ONE_FACE' | 'MULTIPLE_FACES';

export interface CameraFaceDetectionResult {
  faceCount: number;
  predictedClass: FaceCountClass;
  inferenceMs: number;
}

export interface CameraFaceDetector {
  readonly id: string;
  readonly displayName: string;
  readonly executionProvider: string;
  load(): Promise<void>;
  detect(source: CanvasImageSource, timestampMs: number): Promise<CameraFaceDetectionResult>;
  dispose(): Promise<void> | void;
}

export function classifyFaceCount(faceCount: number): FaceCountClass {
  return faceCount === 0 ? 'NO_FACE' : faceCount === 1 ? 'ONE_FACE' : 'MULTIPLE_FACES';
}
