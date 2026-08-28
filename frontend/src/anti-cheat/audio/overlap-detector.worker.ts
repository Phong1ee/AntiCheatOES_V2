/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web';
import ortWasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { analyzeSpeakerEvidence } from './speaker-evidence';
import { OVERLAP_DETECTOR_CONFIG, type OverlapDetectorConfig } from './overlap-detector.config';

let session: ort.InferenceSession | null = null;
let config: OverlapDetectorConfig = { ...OVERLAP_DETECTOR_CONFIG };

self.onmessage = async (event: MessageEvent) => {
  try {
    if (event.data.type === 'init') {
      config = { ...OVERLAP_DETECTOR_CONFIG, ...(event.data.config ?? {}) };
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
    self.postMessage({
      type: 'result',
      generation: event.data.generation,
      ...analyzeSpeakerEvidence(output, config),
      inferenceMs: performance.now() - startedAt,
    });
  } catch (error) {
    self.postMessage({ type: 'error', generation: event.data.generation, message: error instanceof Error ? error.message : 'Overlap detector failed.' });
  }
};
