import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_WASM_ROOT, PROCTORING_MODELS } from "../config/proctoring-models";
import { headPoseFromTransformationMatrix } from "../utils/head-pose";

let detector: FaceLandmarker | null = null;
let debug = false;
type Message = { type: "initialize"; debug?: boolean } | { type: "sample"; bitmap: ImageBitmap; timestamp: number; sequence: number } | { type: "dispose" };
const INIT_TIMEOUT_MS = 15_000;
const metric = (metricName: string, values: Record<string, number | string | boolean>) => { if (debug) self.postMessage({ type: "metric", detector: "faceLandmarker", metric: metricName, values }); };
const within = <T>(promise: Promise<T>) => Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("FaceLandmarker initialization timed out")), INIT_TIMEOUT_MS))]);

async function resolveVisionFileset() { return FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT, true); }
self.onmessage = async ({ data }: MessageEvent<Message>) => {
  if (data.type === "dispose") { detector?.close(); detector = null; self.postMessage({ type: "disposed" }); return; }
  try {
    if (data.type === "initialize") { debug = Boolean(data.debug); self.postMessage({ type: "loading" }); const started = performance.now(); const files = await within(resolveVisionFileset()); metric("wasm_load", { durationMs: performance.now() - started }); detector = await within(FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: PROCTORING_MODELS.face.modelPath }, runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: 0.6, minFacePresenceConfidence: 0.6, minTrackingConfidence: 0.6, outputFacialTransformationMatrixes: true })); metric("model_load", { durationMs: performance.now() - started }); self.postMessage({ type: "ready" }); return; }
    if (!detector) throw new Error("FaceLandmarker is unavailable"); const started = performance.now(); const result = detector.detectForVideo(data.bitmap, data.timestamp); data.bitmap.close(); const pose = headPoseFromTransformationMatrix(result.facialTransformationMatrixes[0]?.data ?? []); const face = result.faceLandmarks[0]; metric("inference", { durationMs: performance.now() - started, matrixAvailable: Boolean(pose) }); self.postMessage({ type: "sample", sequence: data.sequence, timestamp: data.timestamp, yaw: pose?.yaw ?? 0, pitch: pose?.pitch ?? 0, roll: pose?.roll ?? 0, matrixAvailable: Boolean(pose), irisX: face?.[468] && face?.[473] ? (face[468].x + face[473].x) / 2 : 0, irisY: face?.[468] && face?.[473] ? (face[468].y + face[473].y) / 2 : 0 });
  } catch (error) { if (data.type === "sample") data.bitmap.close(); self.postMessage({ type: "error", message: error instanceof Error ? error.message : "FaceLandmarker failed" }); }
};
