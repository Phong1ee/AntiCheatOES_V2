import { MICROPHONE_AI_CONFIG } from './microphone-ai.config';
import { SpeechTemporalFilter, type SpeechIncident } from './speech-temporal-filter';
import ortWasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortWasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

type MicVAD = import('@ricky0123/vad-web').MicVAD;

const onnxWasmPaths = {
  mjs: ortWasmModuleUrl,
  wasm: ortWasmBinaryUrl,
};

export class MicrophoneVadRuntime {
  private vad: MicVAD | null = null;
  private stopped = false;
  private readonly filter = new SpeechTemporalFilter();
  private speechStartedAt: number | null = null;
  private realSpeechConfirmedAt: number | null = null;
  private lastDiagnosticsAt = 0;

  constructor(
    private readonly stream: MediaStream,
    private readonly onIncident: (incident: SpeechIncident) => void,
    private readonly onSpeechFrame?: (probability: number, frame: Float32Array) => void,
    private readonly onSpeechConfirmed?: () => void,
  ) {}

  async start(): Promise<void> {
    const audioTrack = this.stream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState !== 'live') throw new Error('A live microphone track is required for speech detection.');
    const { MicVAD } = await import('@ricky0123/vad-web');
    if (this.stopped) return;
    this.vad = await MicVAD.new({
      model: MICROPHONE_AI_CONFIG.model,
      baseAssetPath: MICROPHONE_AI_CONFIG.baseAssetPath,
      // Import these through Vite so the runtime module is not loaded from public/.
      onnxWASMBasePath: onnxWasmPaths as unknown as string,
      positiveSpeechThreshold: MICROPHONE_AI_CONFIG.positiveSpeechThreshold,
      negativeSpeechThreshold: MICROPHONE_AI_CONFIG.negativeSpeechThreshold,
      redemptionMs: MICROPHONE_AI_CONFIG.silenceRedemptionMs,
      minSpeechMs: MICROPHONE_AI_CONFIG.realSpeechActivationMs,
      submitUserSpeechOnPause: false,
      startOnLoad: false,
      getStream: async () => this.stream,
      // VAD never owns the exam stream, so pausing/destroying it must not stop tracks.
      pauseStream: async () => {},
      resumeStream: async () => this.stream,
      ortConfig: (ort) => {
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;
      },
      onFrameProcessed: ({ isSpeech }, frame) => {
        if (this.stopped) return;
        const now = performance.now();
        if (isSpeech >= MICROPHONE_AI_CONFIG.positiveSpeechThreshold && this.speechStartedAt === null) this.speechStartedAt = now;
        this.onSpeechFrame?.(isSpeech, frame);
        const incident = this.filter.observe(isSpeech, now);
        if (incident) {
          this.logDiagnostics('single speech confirmed', { finalSpeechDurationMs: incident.durationMs });
          this.onIncident(incident);
        }
        this.logDiagnostics('frame', { speechProbability: isSpeech });
      },
      onSpeechRealStart: () => {
        this.realSpeechConfirmedAt = performance.now();
        this.logDiagnostics('real speech confirmed');
        this.onSpeechConfirmed?.();
      },
      // Segments supplied by the library are intentionally ignored and never persisted.
      onSpeechEnd: () => {
        this.logDiagnostics('speech ended');
        this.speechStartedAt = null;
        this.realSpeechConfirmedAt = null;
        this.filter.reset();
      },
    });
    if (this.stopped) {
      await this.vad.destroy();
      this.vad = null;
      return;
    }
    await this.vad.start();
  }

  stop(): void {
    this.stopped = true;
    this.filter.reset();
    const vad = this.vad;
    this.vad = null;
    if (vad) void vad.destroy();
  }

  private logDiagnostics(event: string, details: Record<string, number> = {}): void {
    if (!import.meta.env.DEV) return;
    const now = performance.now();
    if (event === 'frame' && now - this.lastDiagnosticsAt < 1_000) return;
    this.lastDiagnosticsAt = now;
    console.debug('[AntiCheat VAD]', {
      event,
      speechStartedAt: this.speechStartedAt,
      realSpeechConfirmedAt: this.realSpeechConfirmedAt,
      ...details,
    });
  }
}
