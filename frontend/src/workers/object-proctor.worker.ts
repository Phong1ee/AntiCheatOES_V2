import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_WASM_ROOT, PROCTORING_MODELS } from "../config/proctoring-models";

let detector: ObjectDetector | null = null;
let debug = false;
const INIT_TIMEOUT_MS = 15_000;
function metric(metric: string, values: Record<string, number | string | boolean>) { if (debug) self.postMessage({ type: "metric", detector: "phone", metric, values }); }
const within = <T>(promise: Promise<T>) => Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("ObjectDetector initialization timed out")), INIT_TIMEOUT_MS))]);
async function resolveVisionFileset() {
  return FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT, true);
}
self.onmessage = async ({ data }: MessageEvent<{ type: "initialize"; debug?: boolean } | { type: "sample"; bitmap: ImageBitmap; timestamp: number; sequence: number } | { type: "dispose" }>) => {
  if (data.type === "dispose") { detector?.close(); detector = null; self.postMessage({ type: "disposed" }); return; }
  try {
    if (data.type === "initialize") { debug = Boolean(data.debug); self.postMessage({ type: "loading" }); const started = performance.now(); const files = await within(resolveVisionFileset()); metric("wasm_load", { durationMs: performance.now() - started }); const modelStarted = performance.now(); detector = await within(ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: PROCTORING_MODELS.phone.modelPath }, runningMode: "VIDEO", maxResults: 5, scoreThreshold: 0, categoryAllowlist: ["cell phone"] })); metric("model_load", { durationMs: performance.now() - modelStarted }); self.postMessage({ type: "ready" }); return; }
    if (!detector) throw new Error("Object detector is unavailable"); const started = performance.now(); const detection = detector.detectForVideo(data.bitmap, data.timestamp).detections.filter((item) => item.categories.some((category) => category.categoryName === "cell phone")).sort((left, right) => (right.categories[0]?.score ?? 0) - (left.categories[0]?.score ?? 0))[0]; const category = detection?.categories.find((item) => item.categoryName === "cell phone"); const box = detection?.boundingBox; const width = box ? Math.max(0, Math.min(1, box.width / data.bitmap.width)) : 0; const height = box ? Math.max(0, Math.min(1, box.height / data.bitmap.height)) : 0; const inFrame = Boolean(box && box.originX >= 0 && box.originY >= 0 && box.originX + box.width <= data.bitmap.width && box.originY + box.height <= data.bitmap.height); data.bitmap.close(); metric("inference", { durationMs: performance.now() - started }); metric("candidate", { confidence: category?.score ?? 0, category: category?.categoryName ?? "none", boxArea: width * height, inFrame }); self.postMessage({ type: "sample", sequence: data.sequence, confidence: category?.score ?? 0, categoryName: category?.categoryName ?? null, boxArea: width * height, inFrame });
  } catch (error) { if (data.type === "sample") data.bitmap.close(); self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Object detector failed" }); }
};
