const CAMERA_EVENTS = new Set([
  'NO_FACE_DETECTED', 'MULTIPLE_FACES_DETECTED', 'HEAD_AWAY_SUSTAINED', 'GAZE_AWAY_SUSTAINED',
]);
const AUDIO_EVENTS = new Set(['MULTIPLE_VOICES_DETECTED', 'MIC_TRACK_MUTED', 'MIC_TRACK_ENDED']);

export type MonitorEventCategory = 'camera' | 'microphone' | 'browser' | 'system';

export function eventCategory(eventType: string, source?: string): MonitorEventCategory {
  if (CAMERA_EVENTS.has(eventType)) return 'camera';
  if (AUDIO_EVENTS.has(eventType)) return 'microphone';
  if (source === 'camera' || source === 'microphone' || source === 'browser') return source;
  return 'system';
}

export function eventLabel(eventType: string): string {
  return eventType.toLowerCase().split('_').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

export function formatEventDetails(details?: string | null, metadata?: unknown): string {
  const values = typeof metadata === 'string' ? tryParseMetadata(metadata) : metadata;
  if (!values || typeof values !== 'object' || Array.isArray(values)) return details || 'No additional details';
  const fields = values as Record<string, unknown>;
  const formatted = [
    typeof fields.confidence === 'number' ? `Confidence ${Math.round(fields.confidence * 100)}%` : null,
    typeof fields.durationMs === 'number' ? `Duration ${(fields.durationMs / 1_000).toFixed(1)} s` : null,
    typeof fields.overlapProbability === 'number' ? `Overlap ${Math.round(fields.overlapProbability * 100)}%` : null,
    typeof fields.faceCount === 'number' ? `${fields.faceCount} face(s)` : null,
  ].filter((value): value is string => Boolean(value));
  return formatted.length ? formatted.join(' · ') : details || 'No additional details';
}

function tryParseMetadata(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}
