import OverlapWorker from './overlap-detector.worker?worker';
import { OVERLAP_DETECTOR_CONFIG } from './overlap-detector.config';
import { PerformanceController } from '../performance-controller';

export interface OverlapIncident {
  durationMs: number;
  overlapProbability: number;
  p95OverlapProbability: number;
  overlapFrameRatio: number;
  recentContinuousOverlapMs: number;
  inferenceMs: number;
  model: string;
}

export class OverlapDetector {
  private readonly worker = new OverlapWorker();
  private ring = new Float32Array(OVERLAP_DETECTOR_CONFIG.windowSamples);
  private writeIndex = 0;
  private sampleCount = 0;
  private lastSpeechAt = 0;
  private inFlight = false;
  private timer: number | null = null;
  private initializationTimer: number | null = null;
  private cancelInitialization: ((reason: Error) => void) | null = null;
  private readonly performance = new PerformanceController('audio');
  private stopped = false;
  private skippedInferences = 0;
  private lastDiagnosticsAt = 0;
  private generation = 0;

  constructor(
    private readonly onIncident: (incident: OverlapIncident) => void,
    private readonly onRuntimeError: (error: Error) => void = () => {},
  ) {}

  async start(): Promise<void> {
    this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
    this.worker.onerror = () => this.onRuntimeError(new Error('The overlap detection worker stopped unexpectedly.'));
    this.worker.postMessage({ type: 'init', modelUrl: OVERLAP_DETECTOR_CONFIG.modelUrl, overlapThreshold: OVERLAP_DETECTOR_CONFIG.overlapProbabilityThreshold });
    await new Promise<void>((resolve, reject) => {
      this.cancelInitialization = reject;
      this.initializationTimer = window.setTimeout(() => reject(new Error('Timed out loading the overlap detection model.')), 15_000);
      const previous = this.worker.onmessage;
      this.worker.onmessage = (event) => {
        previous?.call(this.worker, event);
        if (event.data.type === 'ready') resolve();
        if (event.data.type === 'error') reject(new Error(event.data.message));
      };
    }).finally(() => {
      if (this.initializationTimer !== null) window.clearTimeout(this.initializationTimer);
      this.initializationTimer = null;
      this.cancelInitialization = null;
    });
    if (this.stopped) return;
    this.scheduleInference();
  }

  observeVadFrame(probability: number, frame: Float32Array): void {
    this.append(frame);
    if (probability >= 0.42) this.lastSpeechAt = performance.now();
  }

  analyzeNow(): void { this.analyzeLatest(); }

  private append(samples: Float32Array): void {
    for (const sample of samples) {
      this.ring[this.writeIndex] = sample;
      this.writeIndex = (this.writeIndex + 1) % this.ring.length;
    }
    this.sampleCount = Math.min(this.ring.length, this.sampleCount + samples.length);
  }

  private analyzeLatest(): void {
    if (this.stopped || this.sampleCount === 0 || performance.now() - this.lastSpeechAt > OVERLAP_DETECTOR_CONFIG.recentSpeechGraceMs) return;
    if (this.inFlight) {
      this.skippedInferences += 1;
      return;
    }
    const samples = new Float32Array(this.ring.length);
    if (this.sampleCount < this.ring.length) {
      samples.set(this.ring.subarray(0, this.sampleCount), this.ring.length - this.sampleCount);
    } else {
      samples.set(this.ring.subarray(this.writeIndex)); samples.set(this.ring.subarray(0, this.writeIndex), this.ring.length - this.writeIndex);
    }
    this.inFlight = true;
    this.worker.postMessage({ type: 'analyze', generation: this.generation, samples: samples.buffer }, [samples.buffer]);
  }

  private scheduleInference(): void {
    if (this.stopped) return;
    this.timer = window.setTimeout(() => { this.analyzeLatest(); this.scheduleInference(); }, Math.max(OVERLAP_DETECTOR_CONFIG.inferenceIntervalMs, this.performance.nextDelayMs()));
  }

  private handleWorkerMessage(message: {
    type: string;
    generation?: number;
    peakOverlapProbability?: number;
    p95OverlapProbability?: number;
    overlapFrameRatio?: number;
    longestContinuousOverlapMs?: number;
    recentContinuousOverlapMs?: number;
    inferenceMs?: number;
  }): void {
    if (message.generation !== undefined && message.generation !== this.generation) return;
    if (message.type === 'error') {
      this.inFlight = false;
      this.onRuntimeError(new Error('The overlap detection worker reported an error.'));
      return;
    }
    if (message.type !== 'result') return;
    this.inFlight = false;
    this.performance.record(message.inferenceMs ?? 0);
    const peakOverlapProbability = message.peakOverlapProbability ?? 0;
    const p95OverlapProbability = message.p95OverlapProbability ?? 0;
    const overlapFrameRatio = message.overlapFrameRatio ?? 0;
    const durationMs = message.longestContinuousOverlapMs ?? 0;
    const recentContinuousOverlapMs = message.recentContinuousOverlapMs ?? 0;
    const inferenceMs = Math.round(message.inferenceMs ?? 0);
    this.logDiagnostics({ peakOverlapProbability, p95OverlapProbability, overlapFrameRatio, durationMs, recentContinuousOverlapMs, inferenceMs });
    // The Worker already proves the continuous overlap duration from its frame timeline.
    if (peakOverlapProbability < OVERLAP_DETECTOR_CONFIG.overlapProbabilityThreshold || durationMs < OVERLAP_DETECTOR_CONFIG.sustainedOverlapMs) return;
    this.onIncident({ durationMs, overlapProbability: peakOverlapProbability, p95OverlapProbability, overlapFrameRatio, recentContinuousOverlapMs, inferenceMs, model: OVERLAP_DETECTOR_CONFIG.modelName });
  }

  resetForAttemptStart(): void {
    this.generation += 1;
    this.ring.fill(0);
    this.writeIndex = 0;
    this.sampleCount = 0;
    this.lastSpeechAt = 0;
    this.inFlight = false;
  }

  stop(): void {
    this.stopped = true;
    this.cancelInitialization?.(new Error('Overlap detector stopped.'));
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.worker.terminate(); this.ring = new Float32Array(0);
  }

  private logDiagnostics(details: Record<string, number>): void {
    if (!import.meta.env.DEV) return;
    const now = performance.now();
    if (now - this.lastDiagnosticsAt < 1_000) return;
    this.lastDiagnosticsAt = now;
    console.debug('[AntiCheat overlap]', {
      ...details,
      averageInferenceMs: Math.round(this.performance.averageInferenceMs),
      adaptiveIntervalMs: Math.round(Math.max(OVERLAP_DETECTOR_CONFIG.inferenceIntervalMs, this.performance.nextDelayMs())),
      skippedInferences: this.skippedInferences,
    });
  }
}
