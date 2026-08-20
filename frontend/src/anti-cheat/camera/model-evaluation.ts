import { TemporalIncidentFilter } from '../temporal-filter';
import { CAMERA_AI_CONFIG } from '../camera-ai.config';
import type { CameraAiEventType } from '../anti-cheat.types';
import type { CameraFaceDetectionResult, FaceCountClass } from './detectors/camera-face-detector';

export type CameraScenario =
  | 'no_face_normal'
  | 'no_face_low_light'
  | 'no_face_student_leaves'
  | 'one_face_normal'
  | 'one_face_glasses'
  | 'one_face_head_movement'
  | 'one_face_far'
  | 'one_face_partial_occlusion'
  | 'one_face_low_light'
  | 'multiple_faces_side'
  | 'multiple_faces_background'
  | 'multiple_faces_second_face_far'
  | 'multiple_faces_partial_occlusion'
  | 'multiple_faces_low_light'
  | 'multiple_faces_enter_leave';
export type EvaluationMode = 'same_frame' | 'face_landmarker_performance' | 'blazeface_short_performance' | 'yunet_performance' | 'scrfd_10gf_performance';
export interface EvaluationRow { session_id: string; scenario: CameraScenario; ground_truth_class: FaceCountClass; timestamp_ms: number; model_id: string; predicted_face_count: number; predicted_class: FaceCountClass; correct: boolean; inference_ms: number; execution_provider: string; incident?: CameraAiEventType; }
export interface EvaluationSummary { model_id: string; scenario: CameraScenario; frames: number; accuracy: number; macro_f1: number; false_violation_rate: number; missed_violation_rate: number; no_face_recall: number; one_face_recall: number; multiple_faces_recall: number; avg_inference_ms: number; p95_inference_ms: number; effective_fps: number; skipped_frames: number; inference_errors: number; false_incidents: number; missed_incidents: number; }

export class ShadowIncidentFilter {
  private readonly filter = new TemporalIncidentFilter();
  observe(prediction: CameraFaceDetectionResult, timestampMs: number): CameraAiEventType | undefined {
    const noFace = this.filter.observe('NO_FACE_DETECTED', prediction.predictedClass === 'NO_FACE', timestampMs, CAMERA_AI_CONFIG.noFaceDurationMs, {});
    const multiple = this.filter.observe('MULTIPLE_FACES_DETECTED', prediction.predictedClass === 'MULTIPLE_FACES', timestampMs, CAMERA_AI_CONFIG.multipleFacesDurationMs, { faceCount: prediction.faceCount });
    return noFace?.eventType ?? multiple?.eventType;
  }
}

const classes: FaceCountClass[] = ['NO_FACE', 'ONE_FACE', 'MULTIPLE_FACES'];
const percentile = (values: number[], p: number) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] : 0;
export function summarize(rows: EvaluationRow[], skipped: Record<string, number> = {}, errors: Record<string, number> = {}): EvaluationSummary[] {
  return [...new Set(rows.map((row) => row.model_id))].map((model_id) => {
    const items = rows.filter((row) => row.model_id === model_id), matches = items.filter((row) => row.correct).length;
    const recall = (target: FaceCountClass) => { const truth = items.filter((row) => row.ground_truth_class === target); return truth.length ? truth.filter((row) => row.predicted_class === target).length / truth.length : 0; };
    const f1 = classes.map((target) => { const tp = items.filter((row) => row.ground_truth_class === target && row.predicted_class === target).length, fp = items.filter((row) => row.ground_truth_class !== target && row.predicted_class === target).length, fn = items.filter((row) => row.ground_truth_class === target && row.predicted_class !== target).length; return tp ? 2 * tp / (2 * tp + fp + fn) : 0; });
    const elapsed = items.length > 1 ? items.at(-1)!.timestamp_ms - items[0].timestamp_ms : 0;
    const incidents = items.filter((row) => row.incident), falseIncidents = incidents.filter((row) => row.ground_truth_class === 'ONE_FACE').length, missedIncidents = items.filter((row) => row.ground_truth_class !== 'ONE_FACE' && !row.incident).length;
    return { model_id, scenario: items[0]?.scenario ?? 'one_face_normal', frames: items.length, accuracy: items.length ? matches / items.length : 0, macro_f1: f1.reduce((a, b) => a + b, 0) / classes.length, false_violation_rate: (() => { const normal = items.filter((r) => r.ground_truth_class === 'ONE_FACE'); return normal.length ? normal.filter((r) => r.predicted_class !== 'ONE_FACE').length / normal.length : 0; })(), missed_violation_rate: (() => { const violation = items.filter((r) => r.ground_truth_class !== 'ONE_FACE'); return violation.length ? violation.filter((r) => r.predicted_class === 'ONE_FACE').length / violation.length : 0; })(), no_face_recall: recall('NO_FACE'), one_face_recall: recall('ONE_FACE'), multiple_faces_recall: recall('MULTIPLE_FACES'), avg_inference_ms: items.reduce((sum, r) => sum + r.inference_ms, 0) / Math.max(1, items.length), p95_inference_ms: percentile(items.map((r) => r.inference_ms), .95), effective_fps: elapsed > 0 ? items.length * 1000 / elapsed : 0, skipped_frames: skipped[model_id] ?? 0, inference_errors: errors[model_id] ?? 0, false_incidents: falseIncidents, missed_incidents: missedIncidents };
  });
}
export function toCsv(rows: Array<Record<string, unknown>>): string { const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))]; return [keys.join(','), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n'); }
export function download(filename: string, content: string, type: string): void { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
