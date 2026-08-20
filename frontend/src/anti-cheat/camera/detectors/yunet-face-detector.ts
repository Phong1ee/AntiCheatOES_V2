import * as ort from 'onnxruntime-web';
import ortWasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { YUNET_MODEL_URL } from '../../camera-ai.config';
import { classifyFaceCount, type CameraFaceDetectionResult, type CameraFaceDetector } from './camera-face-detector';

type Detection = { x: number; y: number; width: number; height: number; score: number };

const INPUT_SIZE = 640;
const SCORE_THRESHOLD = 0.5;
const NMS_IOU_THRESHOLD = 0.3;
const STRIDES = [8, 16, 32] as const;

// Port of the evaluated OpenCV FaceDetectorYN adaptation: BGR float32 input,
// score threshold 0.5, NMS IoU 0.3, and stride heads 8/16/32.
export class YuNetFaceDetector implements CameraFaceDetector {
  readonly id = 'yunet';
  readonly displayName = 'YuNet';
  executionProvider = 'WASM';
  private session: ort.InferenceSession | null = null;
  private canvas: HTMLCanvasElement | null = null;

  async load(): Promise<void> {
    ort.env.wasm.wasmPaths = { mjs: ortWasmModuleUrl, wasm: ortWasmBinaryUrl };
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;

    try {
      this.session = await ort.InferenceSession.create(YUNET_MODEL_URL, {
        executionProviders: ['webgpu', 'wasm'],
      });
      // ORT's browser session does not expose the selected provider. Do not
      // report WebGPU solely because the mixed-provider creation succeeded.
      this.executionProvider = 'WebGPU/WASM (provider unverified)';
    } catch {
      this.session = await ort.InferenceSession.create(YUNET_MODEL_URL, {
        executionProviders: ['wasm'],
      });
      this.executionProvider = 'WASM';
    }
  }

  async detect(source: CanvasImageSource, _timestampMs: number): Promise<CameraFaceDetectionResult> {
    if (!this.session) throw new Error('YuNet has not loaded.');
    const start = performance.now();
    const { tensor, width, height } = this.toTensor(source);
    const output = await this.session.run({ [this.session.inputNames[0]]: tensor });
    const faceCount = this.nms(this.decode(output, width, height)).length;
    return { faceCount, predictedClass: classifyFaceCount(faceCount), inferenceMs: performance.now() - start };
  }

  dispose(): void {
    this.session?.release();
    this.session = null;
    this.canvas = null;
  }

  private toTensor(source: CanvasImageSource) {
    const canvas = this.canvas ??= document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Unable to create image canvas.');

    context.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const pixels = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const input = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
    for (let index = 0, pixel = 0; pixel < pixels.length; pixel += 4, index += 1) {
      input[index] = pixels[pixel + 2];
      input[INPUT_SIZE * INPUT_SIZE + index] = pixels[pixel + 1];
      input[2 * INPUT_SIZE * INPUT_SIZE + index] = pixels[pixel];
    }
    return {
      tensor: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
      width: INPUT_SIZE,
      height: INPUT_SIZE,
    };
  }

  private decode(outputs: Record<string, ort.Tensor>, width: number, height: number): Detection[] {
    const byName = (part: string, stride: number) => {
      const name = this.session!.outputNames.find(
        (value) => value.toLowerCase().includes(part) && value.includes(`_${stride}`),
      );
      if (!name) throw new Error(`YuNet output ${part}_${stride} is unavailable.`);
      return outputs[name].data as Float32Array;
    };
    const faces: Detection[] = [];
    for (const stride of STRIDES) {
      const cls = byName('cls', stride);
      const obj = byName('obj', stride);
      const bbox = byName('bbox', stride);
      const cols = Math.floor(width / stride);
      for (let index = 0; index < cls.length; index += 1) {
        const score = Math.sqrt(cls[index] * obj[index]);
        if (score < SCORE_THRESHOLD) continue;
        const centerX = (index % cols + 0.5) * stride;
        const centerY = (Math.floor(index / cols) + 0.5) * stride;
        const bboxIndex = index * 4;
        const detectionWidth = Math.exp(bbox[bboxIndex + 2]) * stride;
        const detectionHeight = Math.exp(bbox[bboxIndex + 3]) * stride;
        faces.push({
          x: centerX + bbox[bboxIndex] * stride - detectionWidth / 2,
          y: centerY + bbox[bboxIndex + 1] * stride - detectionHeight / 2,
          width: detectionWidth,
          height: detectionHeight,
          score,
        });
      }
    }
    return faces;
  }

  private nms(faces: Detection[]): Detection[] {
    const pending = [...faces].sort((left, right) => right.score - left.score);
    const kept: Detection[] = [];
    while (pending.length) {
      const first = pending.shift()!;
      kept.push(first);
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const other = pending[index];
        const intersectionWidth = Math.max(0, Math.min(first.x + first.width, other.x + other.width) - Math.max(first.x, other.x));
        const intersectionHeight = Math.max(0, Math.min(first.y + first.height, other.y + other.height) - Math.max(first.y, other.y));
        const unionArea = first.width * first.height + other.width * other.height - intersectionWidth * intersectionHeight;
        if (unionArea && intersectionWidth * intersectionHeight / unionArea > NMS_IOU_THRESHOLD) pending.splice(index, 1);
      }
    }
    return kept;
  }
}
