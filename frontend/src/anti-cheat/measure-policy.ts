export interface AntiCheatMeasure {
  enabled: boolean;
  threshold: number;
}

export type AntiCheatMeasures = Record<string, AntiCheatMeasure>;

export const antiCheatMeasureLabels: Record<string, { label: string; group: string }> = {
  TAB_HIDDEN: { label: 'Leaving the exam tab', group: 'Browser' },
  WINDOW_BLUR: { label: 'Leaving the exam window', group: 'Browser' },
  FULLSCREEN_EXIT: { label: 'Exiting fullscreen', group: 'Browser' },
  COPY_ATTEMPT: { label: 'Copy attempt', group: 'Browser' },
  PASTE_ATTEMPT: { label: 'Paste attempt', group: 'Browser' },
  CUT_ATTEMPT: { label: 'Cut attempt', group: 'Browser' },
  PRINT_ATTEMPT: { label: 'Print attempt', group: 'Browser' },
  BLOCKED_SHORTCUT: { label: 'Blocked browser shortcut', group: 'Browser' },
  PAGE_REFRESH: { label: 'Refreshing the exam page', group: 'Browser' },
  CAMERA_PERMISSION_DENIED: { label: 'Camera permission denied', group: 'Camera' },
  CAMERA_TRACK_MUTED: { label: 'Camera paused or muted', group: 'Camera' },
  CAMERA_TRACK_ENDED: { label: 'Camera stopped', group: 'Camera' },
  NO_FACE_DETECTED: { label: 'No face detected', group: 'Camera' },
  MULTIPLE_FACES_DETECTED: { label: 'Multiple faces detected', group: 'Camera' },
  GAZE_AWAY_SUSTAINED: { label: 'Looking away for an extended period', group: 'Camera' },
  HEAD_AWAY_SUSTAINED: { label: 'Head turned away for an extended period', group: 'Camera' },
  MIC_PERMISSION_DENIED: { label: 'Microphone permission denied', group: 'Microphone' },
  MIC_TRACK_MUTED: { label: 'Microphone muted', group: 'Microphone' },
  MIC_TRACK_ENDED: { label: 'Microphone stopped', group: 'Microphone' },
  MULTIPLE_VOICES_DETECTED: { label: 'Multiple voices detected', group: 'Microphone' },
};

export const browserMeasureTypes = Object.keys(antiCheatMeasureLabels).filter(
  (eventType) => antiCheatMeasureLabels[eventType].group === 'Browser',
);
// These are the Teacher-configurable AI rules. Device health events are kept
// disabled so they cannot become hidden violations outside the displayed policy.
export const cameraMeasureTypes = ['NO_FACE_DETECTED', 'MULTIPLE_FACES_DETECTED'];
export const microphoneMeasureTypes = ['MULTIPLE_VOICES_DETECTED'];

export const monitoringGroups = [
  { id: 'browser', label: 'Browser monitoring', description: 'Tab, window, fullscreen, clipboard, shortcuts, and refresh.', eventTypes: browserMeasureTypes },
  { id: 'camera', label: 'Camera monitoring', description: 'Requires a live camera for face monitoring.', eventTypes: cameraMeasureTypes },
  { id: 'microphone', label: 'Microphone monitoring', description: 'Requires a live microphone for voice monitoring.', eventTypes: microphoneMeasureTypes },
] as const;

export type MonitoringGroupId = typeof monitoringGroups[number]['id'];

export const isMonitoringGroupEnabled = (measures: AntiCheatMeasures, groupId: MonitoringGroupId): boolean =>
  monitoringGroups.find((group) => group.id === groupId)?.eventTypes.some((eventType) => measures[eventType]?.enabled) ?? false;

export const hasEnabledMonitoringGroup = (measures: AntiCheatMeasures): boolean =>
  monitoringGroups.some((group) => isMonitoringGroupEnabled(measures, group.id));

export const setMonitoringGroupEnabled = (
  measures: AntiCheatMeasures,
  groupId: MonitoringGroupId,
  enabled: boolean,
): AntiCheatMeasures => {
  const group = monitoringGroups.find((item) => item.id === groupId);
  if (!group) return measures;
  const next = { ...measures };
  const policyGroup = groupId === 'browser' ? 'Browser' : groupId === 'camera' ? 'Camera' : 'Microphone';
  const allGroupEvents = Object.keys(antiCheatMeasureLabels).filter(
    (eventType) => antiCheatMeasureLabels[eventType].group === policyGroup,
  );
  // Turning a group off must also disable technical events emitted by that runtime.
  for (const eventType of allGroupEvents) next[eventType] = { ...next[eventType], enabled: false };
  if (enabled) {
    for (const eventType of group.eventTypes) next[eventType] = { ...next[eventType], enabled: true };
  }
  return next;
};

export const defaultAntiCheatMeasures = (threshold = 5): AntiCheatMeasures => {
  const measures = Object.fromEntries(Object.keys(antiCheatMeasureLabels).map((eventType) => [eventType, { enabled: true, threshold }])) as AntiCheatMeasures;
  for (const eventType of Object.keys(antiCheatMeasureLabels)) {
    const group = antiCheatMeasureLabels[eventType].group;
    if ((group === 'Camera' && !cameraMeasureTypes.includes(eventType)) || (group === 'Microphone' && !microphoneMeasureTypes.includes(eventType))) {
      measures[eventType].enabled = false;
    }
  }
  return measures;
};

export const normalizeAntiCheatMeasures = (value: unknown, fallbackThreshold = 5): AntiCheatMeasures => {
  const defaults = defaultAntiCheatMeasures(fallbackThreshold);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  for (const eventType of Object.keys(defaults)) {
    const measure = (value as Record<string, unknown>)[eventType];
    if (!measure || typeof measure !== 'object' || Array.isArray(measure)) continue;
    const raw = measure as Record<string, unknown>;
    if (typeof raw.enabled === 'boolean') defaults[eventType].enabled = raw.enabled;
    if (Number.isInteger(raw.threshold) && Number(raw.threshold) >= 1 && Number(raw.threshold) <= 100) {
      defaults[eventType].threshold = Number(raw.threshold);
    }
  }
  return defaults;
};
