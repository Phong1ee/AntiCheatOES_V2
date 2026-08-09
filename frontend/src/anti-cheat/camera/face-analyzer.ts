import { CAMERA_AI_CONFIG } from '../camera-ai.config';
import type { FaceObservation } from '../anti-cheat.types';

type Landmark = { x: number; y: number; z?: number };

const LEFT_FACE_EDGE = 234;
const RIGHT_FACE_EDGE = 454;
const NOSE_TIP = 1;
const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;

function point(landmarks: Landmark[], index: number): Landmark | null {
  return landmarks[index] ?? null;
}

function degrees(value: number): number {
  return value * (180 / Math.PI);
}

function eyeOffset(iris: Landmark | null, firstCorner: Landmark | null, secondCorner: Landmark | null): number | null {
  if (!iris || !firstCorner || !secondCorner) return null;
  const minimum = Math.min(firstCorner.x, secondCorner.x);
  const width = Math.abs(firstCorner.x - secondCorner.x);
  if (width < 0.001) return null;
  return (iris.x - minimum) / width - 0.5;
}

export function analyzeFaceLandmarks(faces: Landmark[][]): FaceObservation {
  if (faces.length !== 1) return { faceCount: faces.length, headAway: false, gazeAway: false, yaw: 0, pitch: 0, gazeOffset: null };

  const landmarks = faces[0];
  const nose = point(landmarks, NOSE_TIP);
  const leftEdge = point(landmarks, LEFT_FACE_EDGE);
  const rightEdge = point(landmarks, RIGHT_FACE_EDGE);
  const leftEye = point(landmarks, LEFT_EYE_OUTER);
  const rightEye = point(landmarks, RIGHT_EYE_OUTER);
  if (!nose || !leftEdge || !rightEdge || !leftEye || !rightEye) {
    return { faceCount: 1, headAway: false, gazeAway: false, yaw: 0, pitch: 0, gazeOffset: null };
  }

  const faceCenterX = (leftEdge.x + rightEdge.x) / 2;
  const faceHalfWidth = Math.abs(rightEdge.x - leftEdge.x) / 2;
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const faceHeight = Math.max(Math.abs(rightEye.y - nose.y) * 3, 0.001);
  const yaw = degrees(Math.atan2(nose.x - faceCenterX, Math.max(faceHalfWidth, 0.001)));
  const pitch = degrees(Math.atan2(nose.y - eyeCenterY, faceHeight));
  const headAway = Math.abs(yaw) >= CAMERA_AI_CONFIG.headYawDegrees || Math.abs(pitch) >= CAMERA_AI_CONFIG.headPitchDegrees;

  const leftOffset = eyeOffset(point(landmarks, LEFT_IRIS), point(landmarks, LEFT_EYE_OUTER), point(landmarks, LEFT_EYE_INNER));
  const rightOffset = eyeOffset(point(landmarks, RIGHT_IRIS), point(landmarks, RIGHT_EYE_INNER), point(landmarks, RIGHT_EYE_OUTER));
  const gazeOffset = leftOffset !== null && rightOffset !== null ? (leftOffset + rightOffset) / 2 : null;
  // Iris absence (blink, low light) is neutral; it never becomes a gaze violation.
  const gazeAway = !headAway && gazeOffset !== null && Math.abs(gazeOffset) >= CAMERA_AI_CONFIG.gazeOffset;
  return { faceCount: 1, headAway, gazeAway, yaw, pitch, gazeOffset };
}
