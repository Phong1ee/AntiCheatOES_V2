import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_WASM_ROOT, PROCTORING_MODELS } from "../config/proctoring-models";

let detector: PoseLandmarker | null = null;
let debug = false;
const INIT_TIMEOUT_MS = 15_000;
function metric(metric: string, values: Record<string, number>) { if (debug) self.postMessage({ type: "metric", detector: "pose", metric, values }); }
const within = <T>(promise: Promise<T>) => Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("PoseLandmarker initialization timed out")), INIT_TIMEOUT_MS))]);
async function resolveVisionFileset() {
  return FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT, true);
}
self.onmessage = async ({ data }: MessageEvent<{ type: "initialize"; debug?: boolean } | { type: "sample"; bitmap: ImageBitmap; timestamp: number; sequence: number } | { type: "dispose" }>) => {
  if (data.type === "dispose") { detector?.close(); detector = null; self.postMessage({ type: "disposed" }); return; }
  try {
    if (data.type === "initialize") { debug = Boolean(data.debug); self.postMessage({ type: "loading" }); const started = performance.now(); const files = await within(resolveVisionFileset()); metric("wasm_load", { durationMs: performance.now() - started }); const modelStarted = performance.now(); detector = await within(PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: PROCTORING_MODELS.pose.modelPath }, runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 })); metric("model_load", { durationMs: performance.now() - modelStarted }); self.postMessage({ type: "ready" }); return; }
    if (!detector) throw new Error("Pose detector is unavailable"); const started = performance.now(); const pose = detector.detectForVideo(data.bitmap, data.timestamp).landmarks[0]; data.bitmap.close(); metric("inference", { durationMs: performance.now() - started }); self.postMessage({ type: "sample", sequence: data.sequence, shoulderVisibility: Math.min(pose?.[11]?.visibility ?? 0, pose?.[12]?.visibility ?? 0) });
  } catch (error) { if (data.type === "sample") data.bitmap.close(); self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Pose detector failed" }); }
};
