import { AudioClassifier, FilesetResolver as AudioFilesetResolver } from "@mediapipe/tasks-audio";
import { FaceDetector, FaceLandmarker, FilesetResolver as VisionFilesetResolver, ObjectDetector, PoseLandmarker } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_WASM_ROOT, PROCTORING_MODELS } from "../config/proctoring-models";
import { loadAndVerifyModelAsset } from "../utils/model-asset";

type DiagnosticTest = "vision-wasm" | "audio-wasm" | "face-detector" | "face-landmarker" | "pose-landmarker" | "object-detector" | "audio-classifier";

const errorCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch|network|404|not found/i.test(message)) return "ASSET_FETCH_FAILED";
  if (/wasm|webassembly|modulefactory/i.test(message)) return "WASM_INITIALIZATION_FAILED";
  if (/model|tflite|flatbuffer|task/i.test(message)) return "MODEL_INITIALIZATION_FAILED";
  if (/import|module|loader/i.test(message)) return "WORKER_MODULE_LOADER_FAILED";
  if (/classify|inference/i.test(message)) return "INFERENCE_FAILED";
  return "RUNTIME_INITIALIZATION_FAILED";
};

async function modelLength(modelPath: string) {
  const response = await fetch(modelPath, { cache: "no-store" });
  if (!response.ok) throw new Error(`Model fetch failed with HTTP ${response.status}`);
  return (await response.arrayBuffer()).byteLength;
}

async function run(test: DiagnosticTest) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  if (test === "vision-wasm") {
    const files = await VisionFilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT, true);
    const wasmPath = files.wasmLoaderPath;
    return { startedAt, durationMs: performance.now() - started, wasmPath, result: "PASS" as const };
  }
  if (test === "audio-wasm") {
    const files = await AudioFilesetResolver.forAudioTasks(MEDIAPIPE_WASM_ROOT, true);
    const wasmPath = files.wasmLoaderPath;
    return { startedAt, durationMs: performance.now() - started, wasmPath, result: "PASS" as const };
  }

  if (test === "face-detector") {
    const files = await VisionFilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT, true);
    const wasmPath = files.wasmLoaderPath; const modelByteLength = await modelLength(PROCTORING_MODELS.faceDetector.modelPath);
    const task = await FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: PROCTORING_MODELS.faceDetector.modelPath }, runningMode: "VIDEO" });
    task.close();
    return { startedAt, durationMs: performance.now() - started, wasmPath, modelPath: PROCTORING_MODELS.faceDetector.modelPath, modelByteLength, result: "PASS" as const };
  }
  if (test === "face-landmarker") {
    const files = await VisionFilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT, true);
    const wasmPath = files.wasmLoaderPath; const modelByteLength = await modelLength(PROCTORING_MODELS.face.modelPath);
    const task = await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: PROCTORING_MODELS.face.modelPath }, runningMode: "VIDEO" });
    task.close();
    return { startedAt, durationMs: performance.now() - started, wasmPath, modelPath: PROCTORING_MODELS.face.modelPath, modelByteLength, result: "PASS" as const };
  }
  if (test === "pose-landmarker") {
    const files = await VisionFilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT, true);
    const wasmPath = files.wasmLoaderPath; const modelByteLength = await modelLength(PROCTORING_MODELS.pose.modelPath);
    const task = await PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: PROCTORING_MODELS.pose.modelPath }, runningMode: "VIDEO" });
    task.close();
    return { startedAt, durationMs: performance.now() - started, wasmPath, modelPath: PROCTORING_MODELS.pose.modelPath, modelByteLength, result: "PASS" as const };
  }
  if (test === "object-detector") {
    const files = await VisionFilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT, true);
    const wasmPath = files.wasmLoaderPath; const modelByteLength = await modelLength(PROCTORING_MODELS.phone.modelPath);
    const task = await ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: PROCTORING_MODELS.phone.modelPath }, runningMode: "VIDEO" });
    task.close();
    return { startedAt, durationMs: performance.now() - started, wasmPath, modelPath: PROCTORING_MODELS.phone.modelPath, modelByteLength, result: "PASS" as const };
  }

  const files = await AudioFilesetResolver.forAudioTasks(MEDIAPIPE_WASM_ROOT, true);
  const wasmPath = files.wasmLoaderPath; const model = await loadAndVerifyModelAsset(PROCTORING_MODELS.speech); const modelByteLength = model.byteLength;
  const classifier = await AudioClassifier.createFromOptions(files, { baseOptions: { modelAssetBuffer: model.bytes }, maxResults: 1 });
  const silence = new Float32Array(16_000);
  const tone = Float32Array.from({ length: 16_000 }, (_, index) => Math.sin((2 * Math.PI * 440 * index) / 16_000) * 0.03);
  classifier.classify(silence, 16_000);
  classifier.classify(tone, 16_000);
  classifier.close();
  return { startedAt, durationMs: performance.now() - started, wasmPath, modelPath: PROCTORING_MODELS.speech.modelPath, modelByteLength, result: "PASS" as const, smokeInference: "silence and synthetic tone returned without crashing" };
}

self.onmessage = async ({ data }: MessageEvent<{ test: DiagnosticTest }>) => {
  try {
    self.postMessage({ type: "result", test: data.test, ...await run(data.test) });
  } catch (error) {
    self.postMessage({ type: "result", test: data.test, startedAt: new Date().toISOString(), result: "FAIL", sanitizedErrorCode: errorCode(error), rawError: error instanceof Error ? error.message : String(error) });
  }
};
