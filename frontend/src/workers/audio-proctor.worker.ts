import { AudioClassifier, FilesetResolver } from "@mediapipe/tasks-audio";
import { MEDIAPIPE_WASM_ROOT, PROCTORING_MODELS } from "../config/proctoring-models";
import { loadAndVerifyModelAsset } from "../utils/model-asset";

let classifier: AudioClassifier | null = null;
let debugMetrics = false;

function metric(metricName: string, values: Record<string, number | string>) {
  if (debugMetrics) self.postMessage({ type: "metric", detector: "audio", metric: metricName, values });
}

self.onmessage = async ({ data }: MessageEvent<{ type: "initialize"; debug?: boolean } | { type: "classify"; sequence: number; samples: Float32Array; sampleRate: number } | { type: "dispose" }>) => {
  if (data.type === "dispose") { classifier?.close(); classifier = null; self.postMessage({ type: "disposed" }); return; }
  try {
    if (data.type === "initialize") {
      debugMetrics = Boolean(data.debug);
      const started = performance.now();
      const files = await FilesetResolver.forAudioTasks(MEDIAPIPE_WASM_ROOT, true);
      metric("wasm_load", { durationMs: performance.now() - started });
      const modelStarted = performance.now();
      const model = await loadAndVerifyModelAsset(PROCTORING_MODELS.speech);
      classifier = await AudioClassifier.createFromOptions(files, { baseOptions: { modelAssetBuffer: model.bytes }, maxResults: 20 });
      metric("model_load", { model: "speech", durationMs: performance.now() - modelStarted });
      metric("pipeline_load", { durationMs: performance.now() - started });
      self.postMessage({ type: "ready" }); return;
    }
    if (!classifier) throw new Error("Audio classifier is unavailable");
    const started = performance.now();
    const categories = classifier.classify(data.samples, data.sampleRate).flatMap((result) => result.classifications).flatMap((classification) => classification.categories);
    const speech = categories.filter((category) => category.categoryName === "Speech").sort((first, second) => second.score - first.score)[0];
    metric("inference", { model: "speech", durationMs: performance.now() - started, sampleRate: data.sampleRate });
    self.postMessage({ type: "result", sequence: data.sequence, speechConfidence: speech?.score ?? 0 });
  } catch (error) { self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Audio classifier failed" }); }
};
