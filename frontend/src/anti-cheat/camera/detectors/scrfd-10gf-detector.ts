import * as ort from 'onnxruntime-web';
import ortWasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { SCRFD_10GF_MODEL_URL } from '../../camera-ai.config';
import { classifyFaceCount, type CameraFaceDetectionResult, type CameraFaceDetector } from './camera-face-detector';

type Box = { left: number; top: number; right: number; bottom: number; score: number };
const INPUT = 640;
const STRIDES = [8, 16, 32] as const;

// Port of the verified InsightFace det_10g adapter: top-left letterbox, RGB swap,
// (pixel - 127.5) / 128, 2 anchors, strides 8/16/32, threshold .5 and NMS .4.
export class Scrfd10GfDetector implements CameraFaceDetector {
  readonly id = 'scrfd_10gf';
  readonly displayName = 'SCRFD-10GF';
  executionProvider = 'WASM';
  private session: ort.InferenceSession | null = null;
  private canvas: HTMLCanvasElement | null = null;

  async load(): Promise<void> {
    // Vite fingerprints the ONNX Runtime support files. Supplying those URLs is
    // required; otherwise ORT tries to fetch its WASM binary beside the module.
    ort.env.wasm.wasmPaths = { mjs: ortWasmModuleUrl, wasm: ortWasmBinaryUrl };
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const options: ort.InferenceSession.SessionOptions = { executionProviders: ['webgpu', 'wasm'] };
    try { this.session = await ort.InferenceSession.create(SCRFD_10GF_MODEL_URL, options); this.executionProvider = 'WebGPU'; }
    catch { this.session = await ort.InferenceSession.create(SCRFD_10GF_MODEL_URL, { executionProviders: ['wasm'] }); this.executionProvider = 'WASM'; }
  }

  async detect(source: CanvasImageSource, _timestampMs: number): Promise<CameraFaceDetectionResult> {
    if (!this.session) throw new Error('SCRFD-10GF has not loaded.');
    const start = performance.now(); const { tensor, scale } = this.toTensor(source);
    const outputs = await this.session.run({ [this.session.inputNames[0]]: tensor });
    const boxes = this.decode(outputs, scale);
    return { faceCount: boxes.length, predictedClass: classifyFaceCount(boxes.length), inferenceMs: performance.now() - start };
  }

  dispose(): void { this.session?.release(); this.session = null; this.canvas = null; }

  private toTensor(source: CanvasImageSource): { tensor: ort.Tensor; scale: number } {
    const width = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLCanvasElement ? source.width : source instanceof ImageBitmap ? source.width : 0;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLCanvasElement ? source.height : source instanceof ImageBitmap ? source.height : 0;
    if (!width || !height) throw new Error('Camera frame has no dimensions.');
    const scale = Math.min(INPUT / width, INPUT / height); const resizedWidth = Math.floor(width * scale); const resizedHeight = Math.floor(height * scale);
    const canvas = this.canvas ??= document.createElement('canvas'); canvas.width = INPUT; canvas.height = INPUT;
    const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Unable to create image canvas.');
    context.fillStyle = 'black'; context.fillRect(0, 0, INPUT, INPUT); context.drawImage(source, 0, 0, resizedWidth, resizedHeight);
    const pixels = context.getImageData(0, 0, INPUT, INPUT).data; const input = new Float32Array(3 * INPUT * INPUT);
    for (let pixel = 0, index = 0; pixel < pixels.length; pixel += 4, index += 1) {
      input[index] = (pixels[pixel + 2] - 127.5) / 128; input[INPUT * INPUT + index] = (pixels[pixel + 1] - 127.5) / 128; input[2 * INPUT * INPUT + index] = (pixels[pixel] - 127.5) / 128;
    }
    return { tensor: new ort.Tensor('float32', input, [1, 3, INPUT, INPUT]), scale };
  }

  private decode(outputs: Record<string, ort.Tensor>, scale: number): Box[] {
    const values = this.session!.outputNames.map((name) => outputs[name].data as Float32Array); const boxes: Box[] = [];
    STRIDES.forEach((stride, level) => {
      const scores = values[level], distances = values[level + 3]; const cells = (INPUT / stride) ** 2;
      for (let i = 0; i < scores.length; i += 1) { const score = scores[i]; if (score < 0.5) continue; const cell = i % cells; const x = (cell % (INPUT / stride)) * stride; const y = Math.floor(cell / (INPUT / stride)) * stride; const base = i * 4;
        boxes.push({ left: (x - distances[base] * stride) / scale, top: (y - distances[base + 1] * stride) / scale, right: (x + distances[base + 2] * stride) / scale, bottom: (y + distances[base + 3] * stride) / scale, score }); }
    });
    return this.nms(boxes);
  }

  private nms(boxes: Box[]): Box[] { const pending = [...boxes].sort((a, b) => b.score - a.score); const kept: Box[] = []; while (pending.length) { const best = pending.shift()!; kept.push(best); for (let i = pending.length - 1; i >= 0; i -= 1) { const other = pending[i]; const left = Math.max(best.left, other.left), top = Math.max(best.top, other.top), right = Math.min(best.right, other.right), bottom = Math.min(best.bottom, other.bottom); const intersection = Math.max(0, right - left + 1) * Math.max(0, bottom - top + 1); const area = (best.right - best.left + 1) * (best.bottom - best.top + 1) + (other.right - other.left + 1) * (other.bottom - other.top + 1) - intersection; if (area > 0 && intersection / area > .4) pending.splice(i, 1); } } return kept; }
}
