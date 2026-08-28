import { useEffect, useMemo, useRef, useState } from 'react';
import { MicrophoneVadRuntime } from '../../anti-cheat/microphone-vad-runtime';
import { OVERLAP_DETECTOR_CONFIG } from '../../anti-cheat/audio/overlap-detector.config';
import { OverlapDetector, type OverlapDetectorConfig, type OverlapDiagnostics, type OverlapIncident } from '../../anti-cheat/audio/overlap-detector';

type TunableKey = 'inferenceIntervalMs' | 'speechActivityProbabilityThreshold' | 'overlapProbabilityThreshold' | 'sustainedOverlapMs' | 'recentOverlapWindowMs' | 'turnTakingWindowMs' | 'singleSpeakerProbabilityThreshold' | 'minimumSpeakerTurnMs' | 'minimumSpeakerSwitches' | 'cooldownMs';
type Incident = OverlapIncident & { detectedAt: string };

const fields: Array<{ key: TunableKey; label: string; step: number; min: number; hint: string }> = [
  { key: 'inferenceIntervalMs', label: 'Inference interval (ms)', step: 25, min: 100, hint: 'Lower checks sooner but consumes more CPU.' },
  { key: 'speechActivityProbabilityThreshold', label: 'Speech activity gate', step: 0.01, min: 0.05, hint: 'Lower = analyzes quieter microphone input.' },
  { key: 'overlapProbabilityThreshold', label: 'Overlap confidence', step: 0.01, min: 0.1, hint: 'Lower = more sensitive to simultaneous speech.' },
  { key: 'sustainedOverlapMs', label: 'Overlap duration (ms)', step: 100, min: 100, hint: 'Continuous overlap required before a flag.' },
  { key: 'recentOverlapWindowMs', label: 'Overlap lookback (ms)', step: 100, min: 500, hint: 'How much recent audio is assessed for overlap.' },
  { key: 'turnTakingWindowMs', label: 'Turn-taking window (ms)', step: 500, min: 1_000, hint: 'Time allowed to observe alternating speakers.' },
  { key: 'singleSpeakerProbabilityThreshold', label: 'Single speaker confidence', step: 0.01, min: 0.1, hint: 'Confidence needed to identify one speaker slot.' },
  { key: 'minimumSpeakerTurnMs', label: 'Minimum turn (ms)', step: 100, min: 100, hint: 'Shorter turns are ignored as noise.' },
  { key: 'minimumSpeakerSwitches', label: 'Minimum switches', step: 1, min: 1, hint: 'Two means A → B → A is required.' },
  { key: 'cooldownMs', label: 'Incident cooldown (ms)', step: 500, min: 0, hint: 'Time between two recorded incidents.' },
];

const blankDiagnostics: OverlapDiagnostics = { peakOverlapProbability: 0, p95OverlapProbability: 0, overlapFrameRatio: 0, durationMs: 0, recentContinuousOverlapMs: 0, distinctSpeakerCount: 0, qualifyingSpeakerTurns: 0, speakerSwitches: 0, inferenceMs: 0 };
// A short question-and-answer exchange commonly has one 0.5-1.5 second prompt
// followed by a short answer. This profile is deliberately for lab validation,
// not an automatic production policy.
const EXAM_CONVERSATION_PROFILE: OverlapDetectorConfig = {
  ...OVERLAP_DETECTOR_CONFIG,
  inferenceIntervalMs: 125,
  speechActivityProbabilityThreshold: 0.35,
  overlapProbabilityThreshold: 0.50,
  sustainedOverlapMs: 800,
  recentOverlapWindowMs: 1_500,
  turnTakingWindowMs: 4_000,
  singleSpeakerProbabilityThreshold: 0.60,
  minimumSpeakerTurnMs: 400,
  minimumSpeakerSwitches: 1,
};

function formatMs(value: number) { return `${Math.round(value)} ms`; }

export function MicrophoneModelComparison() {
  const stream = useRef<MediaStream | null>(null);
  const detector = useRef<OverlapDetector | null>(null);
  const vad = useRef<MicrophoneVadRuntime | null>(null);
  const cooldownUntil = useRef(0);
  const [settings, setSettings] = useState<OverlapDetectorConfig>({ ...EXAM_CONVERSATION_PROFILE });
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('Ready. Configure thresholds, then start the microphone.');
  const [diagnostics, setDiagnostics] = useState<OverlapDiagnostics>(blankDiagnostics);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const sensitivity = useMemo(() => settings.overlapProbabilityThreshold <= 0.5 || settings.sustainedOverlapMs < 1_200 || settings.minimumSpeakerTurnMs < 600 ? 'Sensitive' : settings.overlapProbabilityThreshold >= 0.65 && settings.sustainedOverlapMs >= 1_800 ? 'Conservative' : 'Balanced', [settings]);

  const stop = () => {
    vad.current?.stop(); vad.current = null;
    detector.current?.stop(); detector.current = null;
    stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
    setActive(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    if (active) return;
    setStatus('Requesting microphone and loading the local ONNX model...');
    setDiagnostics(blankDiagnostics);
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      stream.current = micStream;
      const handleIncident = (incident: OverlapIncident) => {
        if (performance.now() < cooldownUntil.current) return;
        cooldownUntil.current = performance.now() + settings.cooldownMs;
        setIncidents((current) => [{ ...incident, detectedAt: new Date().toLocaleTimeString() }, ...current].slice(0, 20));
        setStatus(incident.detectionMode === 'overlap' ? 'Overlap detected. Review the evidence below.' : 'Alternating speakers detected. Review the evidence below.');
      };
      const overlap = new OverlapDetector(handleIncident, (error) => setStatus(error.message), settings, setDiagnostics);
      const microphoneVad = new MicrophoneVadRuntime(micStream, (probability, frame) => overlap.observeVadFrame(probability, frame), () => overlap.analyzeNow(), (error) => setStatus(error.message));
      detector.current = overlap; vad.current = microphoneVad;
      await overlap.start(); await microphoneVad.start();
      setActive(true); setStatus('Monitoring locally. No audio or incident is sent to the server.');
    } catch (error) {
      stop();
      setStatus(error instanceof Error ? `Could not start: ${error.message}` : 'Could not start the microphone.');
    }
  };

  const update = (key: TunableKey, value: number) => setSettings((current) => ({ ...current, [key]: value }));
  const applyExamProfile = () => { setSettings({ ...EXAM_CONVERSATION_PROFILE }); setDiagnostics(blankDiagnostics); setIncidents([]); setStatus('Short exam conversation profile applied. Start a new session to apply it.'); };
  const reset = () => { setSettings({ ...OVERLAP_DETECTOR_CONFIG }); setDiagnostics(blankDiagnostics); setIncidents([]); setStatus('Production defaults restored. Start a new session to apply them.'); };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#164e63,_transparent_34%),radial-gradient(circle_at_80%_20%,_#4c1d95,_transparent_28%),#08111f] p-4 text-slate-100 sm:p-8">
    <section className="mx-auto max-w-6xl">
      <div className="border-b border-cyan-300/20 pb-6"><p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Development laboratory / local-only</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Microphone Evidence Lab</h1><p className="mt-3 max-w-3xl text-slate-300">Use the exact pyannote segmentation model and VAD pipeline from the exam runtime to tune evidence thresholds. This page never sends audio, recordings, or violations to the backend.</p></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 shadow-2xl shadow-cyan-950/40 backdrop-blur"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Live detector</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{active ? 'LISTENING' : 'IDLE'}</span></div><p className="mt-2 text-sm text-slate-400">{status}</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Peak overlap" value={`${Math.round(diagnostics.peakOverlapProbability * 100)}%`} /><Metric label="P95 overlap" value={`${Math.round(diagnostics.p95OverlapProbability * 100)}%`} /><Metric label="Longest overlap" value={formatMs(diagnostics.durationMs)} /><Metric label="Inference" value={formatMs(diagnostics.inferenceMs)} /></div><div className="mt-3 grid grid-cols-3 gap-3"><Metric label="Speaker slots" value={String(diagnostics.distinctSpeakerCount)} /><Metric label="Qualifying turns" value={String(diagnostics.qualifyingSpeakerTurns)} /><Metric label="Switches" value={String(diagnostics.speakerSwitches)} /></div><div className="mt-5 flex flex-wrap gap-3"><button className="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-50" disabled={active} onClick={() => void start()}>Start microphone</button><button className="rounded-xl border border-white/20 px-4 py-2 font-bold disabled:opacity-50" disabled={!active} onClick={stop}>Stop</button><button className="rounded-xl border border-white/20 px-4 py-2 text-sm" onClick={() => setIncidents([])}>Clear evidence</button></div><div className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-950/30 p-4 text-sm text-cyan-100"><strong>Test script:</strong> (1) one person speaks for 5 seconds: no flag; (2) two people overlap for at least the selected duration: <code>overlap</code>; (3) A → B → A within the selected turn window: <code>turn_taking</code>. Settings apply when you start the next session.</div></section>
        <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 shadow-2xl shadow-fuchsia-950/30 backdrop-blur"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Tuning panel</h2><span className="text-sm font-bold text-fuchsia-300">{sensitivity}</span></div><p className="mt-2 text-sm text-slate-400">The short exam conversation profile is loaded: a 0.5-1.5 second prompt followed by a brief answer can flag quickly. Lower confidence/duration values increase false-positive risk.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{fields.map((field) => <label key={field.key} className="rounded-xl border border-white/10 bg-white/5 p-3"><span className="block text-sm font-semibold">{field.label}</span><span className="mt-1 block text-xs text-slate-400">{field.hint}</span><input className="mt-3 w-full accent-cyan-300" type="number" min={field.min} step={field.step} value={settings[field.key]} onChange={(event) => update(field.key, Number(event.target.value))} /><span className="mt-1 block text-xs text-cyan-200">Current: {settings[field.key]}</span></label>)}</div><div className="mt-4 flex flex-wrap gap-3"><button className="rounded-xl bg-fuchsia-300/15 px-4 py-2 text-sm font-bold text-fuchsia-200" onClick={applyExamProfile}>Apply short exam profile</button><button className="rounded-xl border border-fuchsia-300/40 px-4 py-2 text-sm font-bold text-fuchsia-200" onClick={reset}>Restore production defaults</button></div></section>
      </div>
      <section className="mt-6 rounded-3xl border border-white/10 bg-slate-950/65 p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Evidence log</h2><span className="text-sm text-slate-400">{incidents.length} local incident(s)</span></div>{incidents.length === 0 ? <p className="mt-4 text-sm text-slate-400">No incident yet. Evidence remains only in this browser tab and is discarded on refresh.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{incidents.map((incident, index) => <article key={`${incident.detectedAt}-${index}`} className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4"><div className="flex justify-between gap-4"><strong className="text-amber-200">{incident.detectionMode === 'overlap' ? 'OVERLAP' : 'TURN TAKING'}</strong><span className="text-xs text-slate-400">{incident.detectedAt}</span></div><p className="mt-2 text-sm text-slate-300">Peak overlap {Math.round(incident.overlapProbability * 100)}% · {formatMs(incident.durationMs)} · {incident.distinctSpeakerCount} speaker slots · {incident.speakerSwitches} switches</p></article>)}</div>}</section>
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-bold text-white">{value}</p></div>; }
