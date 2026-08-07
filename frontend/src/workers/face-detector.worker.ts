import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_WASM_ROOT, PROCTORING_MODELS } from "../config/proctoring-models";
import { VISION_POLICY } from "../config/proctoring-policy";

let detector: FaceDetector | null = null;
let debug = false;
let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
type Box = { x: number; y: number; area: number; width: number; height: number };
type Message = { type: "initialize"; debug?: boolean } | { type: "sample"; bitmap: ImageBitmap; timestamp: number; sequence: number } | { type: "dispose" };

const INIT_TIMEOUT_MS = 15_000;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const metric = (metricName: string, values: Record<string, number | string>) => { if (debug) self.postMessage({ type: "metric", detector: "faceDetector", metric: metricName, values }); };
const within = <T>(promise: Promise<T>) => Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("FaceDetector initialization timed out")), INIT_TIMEOUT_MS))]);

async function resolveVisionFileset() {
  return FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT, true);
}

function imageQuality(bitmap: ImageBitmap, box: Box) {
  canvas ??= new OffscreenCanvas(64, 48); context ??= canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { brightness: 0, contrast: 0, sharpness: 0 };
  const sourceX = Math.max(0, Math.floor((box.x - box.width / 2) * bitmap.width)); const sourceY = Math.max(0, Math.floor((box.y - box.height / 2) * bitmap.height)); const sourceWidth = Math.max(1, Math.min(bitmap.width - sourceX, Math.ceil(box.width * bitmap.width))); const sourceHeight = Math.max(1, Math.min(bitmap.height - sourceY, Math.ceil(box.height * bitmap.height)));
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 64, 48);
  const pixels = context.getImageData(0, 0, 64, 48).data; const luminance: number[] = [];
  for (let index = 0; index < pixels.length; index += 4) luminance.push((0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255);
  const mean = luminance.reduce((total, value) => total + value, 0) / luminance.length; const contrast = Math.sqrt(luminance.reduce((total, value) => total + (value - mean) ** 2, 0) / luminance.length);
  let differences = 0; let count = 0;
  for (let y = 0; y < 47; y += 1) for (let x = 0; x < 63; x += 1) { const index = y * 64 + x; differences += Math.abs(luminance[index] - luminance[index + 1]) + Math.abs(luminance[index] - luminance[index + 64]); count += 2; }
  return { brightness: mean, contrast, sharpness: (differences / Math.max(count, 1)) * 255 };
}

function boxFromDetection(item: { boundingBox?: { originX: number; originY: number; width: number; height: number } }, bitmap: ImageBitmap): Box | null {
  const source = item.boundingBox; if (!source || bitmap.width <= 0 || bitmap.height <= 0) return null;
  const width = clamp(source.width / bitmap.width); const height = clamp(source.height / bitmap.height); return { x: clamp((source.originX + source.width / 2) / bitmap.width), y: clamp((source.originY + source.height / 2) / bitmap.height), width, height, area: width * height };
}
function sizeSuitability(area: number) { const { acceptableMin, preferredMin, preferredMax, acceptableMax } = VISION_POLICY.quality.size; if (area < acceptableMin || area > acceptableMax) return 0; if (area < preferredMin) return (area - acceptableMin) / (preferredMin - acceptableMin); if (area <= preferredMax) return 1; return (acceptableMax - area) / (acceptableMax - preferredMax); }
function brightnessSuitability(brightness: number) { const { acceptableMin, acceptableMax, limitMin, limitMax } = VISION_POLICY.quality.brightness; if (brightness < limitMin || brightness > limitMax) return 0; if (brightness < acceptableMin) return (brightness - limitMin) / (acceptableMin - limitMin); if (brightness <= acceptableMax) return 1; return (limitMax - brightness) / (limitMax - acceptableMax); }

self.onmessage = async ({ data }: MessageEvent<Message>) => {
  if (data.type === "dispose") { detector?.close(); detector = null; self.postMessage({ type: "disposed" }); return; }
  try {
    if (data.type === "initialize") { debug = Boolean(data.debug); self.postMessage({ type: "loading" }); const started = performance.now(); const files = await within(resolveVisionFileset()); metric("wasm_load", { durationMs: performance.now() - started }); detector = await within(FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: PROCTORING_MODELS.faceDetector.modelPath }, runningMode: "VIDEO", minDetectionConfidence: VISION_POLICY.faceDetection.minimumConfidence })); metric("model_load", { durationMs: performance.now() - started }); self.postMessage({ type: "ready" }); return; }
    if (!detector) throw new Error("FaceDetector is unavailable"); const started = performance.now(); const detections = detector.detectForVideo(data.bitmap, data.timestamp).detections.map((item) => ({ confidence: item.categories[0]?.score ?? 0, box: boxFromDetection(item, data.bitmap) })).filter((candidate) => candidate.box && candidate.confidence >= VISION_POLICY.faceDetection.minimumConfidence) as Array<{ confidence: number; box: Box }>;
    const accepted = detections[0]; const quality = accepted ? imageQuality(data.bitmap, accepted.box) : { brightness: 0, contrast: 0, sharpness: 0 }; const qualityScore = accepted ? 0.30 * accepted.confidence + 0.25 * sizeSuitability(accepted.box.area) + 0.20 * brightnessSuitability(quality.brightness) + 0.15 * clamp(quality.contrast / VISION_POLICY.quality.contrastReference) + 0.10 * clamp(quality.sharpness / VISION_POLICY.quality.sharpnessReference) : 0;
    data.bitmap.close(); metric("inference", { durationMs: performance.now() - started, faceCount: detections.length }); self.postMessage({ type: "sample", sequence: data.sequence, timestamp: data.timestamp, faceCount: detections.length, confidence: accepted?.confidence ?? 0, box: accepted?.box ?? null, qualityScore: clamp(qualityScore) });
  } catch (error) { if (data.type === "sample") data.bitmap.close(); self.postMessage({ type: "error", message: error instanceof Error ? error.message : "FaceDetector failed" }); }
};
