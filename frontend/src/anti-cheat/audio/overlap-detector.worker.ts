/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web';
import ortWasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

let session: ort.InferenceSession | null = null;
let threshold = 0.55;

function overlapEvidence(output: Float32Array): {
  peakOverlapProbability: number;
  p95OverlapProbability: number;
  overlapFrameRatio: number;
  longestContinuousOverlapMs: number;
  recentContinuousOverlapMs: number;
} {
  const frameCount = Math.floor(output.length / 7);
  // The newest speech is at the end of the 10-second window. Ignoring the
  // older context keeps a short current overlap from being diluted by silence.
  const firstFrame = Math.floor(frameCount * 0.75);
  let frames = 0;
  let peak = 0;
  let matchingFrames = 0;
  let longestRun = 0;
  let currentRun = 0;
  const probabilities: number[] = [];
  for (let offset = firstFrame * 7; offset + 6 < output.length; offset += 7) {
    let max = -Infinity;
    for (let index = 0; index < 7; index += 1) max = Math.max(max, output[offset + index]);
    let denominator = 0;
    let overlap = 0;
    for (let index = 0; index < 7; index += 1) {
      const probability = Math.exp(output[offset + index] - max);
      denominator += probability;
      if (index >= 4) overlap += probability;
    }
    const overlapProbability = overlap / denominator;
    probabilities.push(overlapProbability);
    frames += 1;
    peak = Math.max(peak, overlapProbability);
    if (overlapProbability >= threshold) {
      matchingFrames += 1;
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
    }
    else currentRun = 0;
  }
  const sorted = [...probabilities].sort((left, right) => left - right);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
  const frameDurationMs = frameCount ? 10_000 / frameCount : 0;
  return {
    peakOverlapProbability: peak,
    p95OverlapProbability: p95,
    overlapFrameRatio: frames ? matchingFrames / frames : 0,
    longestContinuousOverlapMs: longestRun * frameDurationMs,
    recentContinuousOverlapMs: currentRun * frameDurationMs,
  };
}

self.onmessage = async (event: MessageEvent) => {
  try {
    if (event.data.type === 'init') {
      threshold = event.data.overlapThreshold ?? threshold;
      ort.env.wasm.wasmPaths = { mjs: ortWasmModuleUrl, wasm: ortWasmBinaryUrl };
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      session = await ort.InferenceSession.create(event.data.modelUrl, { executionProviders: ['wasm'] });
      self.postMessage({ type: 'ready' });
      return;
    }
    if (event.data.type !== 'analyze' || !session) return;
    const startedAt = performance.now();
    const samples = new Float32Array(event.data.samples);
    const input = new ort.Tensor('float32', samples, [1, 1, samples.length]);
    const result = await session.run({ [session.inputNames[0]]: input });
    const output = result[session.outputNames[0]].data as Float32Array;
    self.postMessage({ type: 'result', ...overlapEvidence(output), inferenceMs: performance.now() - startedAt });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Overlap detector failed.' });
  }
};
