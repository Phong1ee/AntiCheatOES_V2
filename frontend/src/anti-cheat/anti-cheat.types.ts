export type CameraAiEventType =
  | 'NO_FACE_DETECTED'
  | 'MULTIPLE_FACES_DETECTED'
  | 'HEAD_AWAY_SUSTAINED'
  | 'GAZE_AWAY_SUSTAINED';

export type CameraAiStatus = 'inactive' | 'loading' | 'ready' | 'unavailable';

export interface CameraAiIncident {
  eventType: CameraAiEventType;
  details: string;
  metadata: Record<string, number>;
}

export interface FaceObservation {
  faceCount: number;
  headAway: boolean;
  gazeAway: boolean;
  yaw: number;
  pitch: number;
}
