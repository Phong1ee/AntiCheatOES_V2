import { useMemo, useState } from "react";
import { PROCTORING_RUNTIME_ASSETS, type ProctoringRuntimeAsset } from "../../config/proctoring-models";

type AssetResult = { id: string; url: string; status: number | null; contentType: string | null; contentLength: string | null; byteLength: number | null; expectedSha256: string; actualSha256: string | null; header: string; result: "PASS" | "FAIL"; sanitizedErrorCode?: string; rawError?: string };
type RuntimeResult = { test: TestId; startedAt: string; durationMs?: number; wasmPath?: string; modelPath?: string; modelByteLength?: number; result: "PASS" | "FAIL"; sanitizedErrorCode?: string; rawError?: string; smokeInference?: string };
type TestId = "vision-wasm" | "audio-wasm" | "face-detector" | "face-landmarker" | "pose-landmarker" | "object-detector" | "audio-classifier";

const TESTS: ReadonlyArray<{ id: TestId; label: string; packageName: string }> = [
  { id: "vision-wasm", label: "Vision WASM only", packageName: "@mediapipe/tasks-vision@1.0.1" },
  { id: "audio-wasm", label: "Audio WASM only", packageName: "@mediapipe/tasks-audio@1.0.1" },
  { id: "face-detector", label: "FaceDetector only", packageName: "@mediapipe/tasks-vision@1.0.1" },
  { id: "face-landmarker", label: "FaceLandmarker only", packageName: "@mediapipe/tasks-vision@1.0.1" },
  { id: "pose-landmarker", label: "PoseLandmarker only", packageName: "@mediapipe/tasks-vision@1.0.1" },
  { id: "object-detector", label: "ObjectDetector only", packageName: "@mediapipe/tasks-vision@1.0.1" },
  { id: "audio-classifier", label: "AudioClassifier only", packageName: "@mediapipe/tasks-audio@1.0.1" },
];

const digest = async (buffer: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const headerText = (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 1024))).trimStart().toLowerCase();
const unsafeResponse = (bytes: Uint8Array) => /^(<!doctype|<html|\{|\[|error\b)/.test(headerText(bytes));
const tfliteHeader = (bytes: Uint8Array) => bytes.length >= 8 && new TextDecoder().decode(bytes.slice(4, 8)) === "TFL3";
const taskHeader = (bytes: Uint8Array) => bytes.length >= 6 && bytes.some((_, index) => index < 8 && bytes[index] === 0x50 && bytes[index + 1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[index + 2]) && [0x04, 0x06, 0x08].includes(bytes[index + 3]));
const wasmHeader = (bytes: Uint8Array) => bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d;

function validateHeader(asset: ProctoringRuntimeAsset, bytes: Uint8Array) {
  if (unsafeResponse(bytes)) return "rejected HTML/JSON/text error response";
  if (asset.url.endsWith(".tflite")) return tfliteHeader(bytes) ? "TFL3 at offset 4" : "missing TFL3 at offset 4";
  if (asset.url.endsWith(".task")) return taskHeader(bytes) ? "valid task ZIP bundle header" : "missing task ZIP bundle header";
  if (asset.url.endsWith(".wasm")) return wasmHeader(bytes) ? "valid WebAssembly magic" : "missing WebAssembly magic";
  return bytes.length > 0 ? "non-empty JavaScript loader" : "empty JavaScript loader";
}

async function checkAsset(asset: ProctoringRuntimeAsset): Promise<AssetResult> {
  try {
    const response = await fetch(asset.url, { cache: "no-store" });
    const buffer = await response.arrayBuffer(); const bytes = new Uint8Array(buffer); const header = validateHeader(asset, bytes);
    const actualSha256 = await digest(buffer); const validHeader = !header.startsWith("missing") && !header.startsWith("rejected") && !header.startsWith("empty");
    return { id: asset.id, url: asset.url, status: response.status, contentType: response.headers.get("content-type"), contentLength: response.headers.get("content-length"), byteLength: buffer.byteLength, expectedSha256: asset.expectedSha256, actualSha256, header, result: response.ok && validHeader && actualSha256 === asset.expectedSha256 ? "PASS" : "FAIL" };
  } catch (error) {
    return { id: asset.id, url: asset.url, status: null, contentType: null, contentLength: null, byteLength: null, expectedSha256: asset.expectedSha256, actualSha256: null, header: "not evaluated", result: "FAIL", sanitizedErrorCode: "ASSET_FETCH_FAILED", rawError: error instanceof Error ? error.message : String(error) };
  }
}

function runRuntimeTest(test: TestId) {
  return new Promise<RuntimeResult>((resolve) => {
    const worker = new Worker(new URL("../../workers/proctoring-runtime-diagnostic.worker.ts", import.meta.url), { type: "module" });
    const timer = window.setTimeout(() => { worker.terminate(); resolve({ test, startedAt: new Date().toISOString(), result: "FAIL", sanitizedErrorCode: "WORKER_INITIALIZATION_TIMEOUT", rawError: "Worker did not return within 20 seconds" }); }, 20_000);
    worker.onmessage = ({ data }) => { window.clearTimeout(timer); worker.terminate(); resolve(data as RuntimeResult); };
    worker.onerror = (event) => { window.clearTimeout(timer); worker.terminate(); resolve({ test, startedAt: new Date().toISOString(), result: "FAIL", sanitizedErrorCode: "WORKER_MODULE_LOADER_FAILED", rawError: event.message }); };
    worker.postMessage({ test });
  });
}

function download(filename: string, content: string) {
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" })); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
}

export function ProctoringRuntimeDiagnostics() {
  const [assets, setAssets] = useState<AssetResult[]>([]); const [runtime, setRuntime] = useState<RuntimeResult[]>([]); const [running, setRunning] = useState(false);
  const report = useMemo(() => ({ generatedAt: new Date().toISOString(), packageVersions: { vision: "1.0.1", audio: "1.0.1" }, assets: assets.map(({ rawError: _rawError, ...asset }) => asset), runtime: runtime.map(({ rawError: _rawError, ...test }) => test), privacy: "No student information, tokens, frames, audio, or answers are collected by this diagnostic." }), [assets, runtime]);
  const runAssets = async () => { setRunning(true); const results: AssetResult[] = []; for (const asset of PROCTORING_RUNTIME_ASSETS) { const result = await checkAsset(asset); results.push(result); setAssets([...results]); } setRunning(false); };
  const runTest = async (test: TestId) => { setRunning(true); const result = await runRuntimeTest(test); setRuntime((current) => [...current.filter((item) => item.test !== test), result]); setRunning(false); };
  const runAll = async () => { await runAssets(); for (const test of TESTS) await runTest(test.id); };
  const markdown = () => ["# Proctoring Runtime Diagnostic", "", `Generated: ${report.generatedAt}`, "", "## Assets", ...report.assets.map((asset) => `- ${asset.id}: ${asset.result}; HTTP ${asset.status ?? "n/a"}; ${asset.byteLength ?? "n/a"} bytes; ${asset.header}`), "", "## Runtime", ...report.runtime.map((test) => `- ${test.test}: ${test.result}; ${test.sanitizedErrorCode ?? "OK"}; ${test.durationMs?.toFixed(1) ?? "n/a"} ms`)].join("\n");
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100"><div className="mx-auto max-w-7xl space-y-6"><header><p className="text-sm font-medium text-cyan-300">Development only</p><h1 className="mt-1 text-3xl font-bold">Proctoring Runtime Self-Test</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">Each runtime check uses a new worker and initializes at most one MediaPipe task. No camera, microphone, student data, frames, raw audio, answers, or session data are read.</p></header><div className="flex flex-wrap gap-3"><button className="rounded bg-cyan-600 px-4 py-2 font-medium disabled:opacity-50" disabled={running} onClick={() => void runAll()}>Run all checks</button><button className="rounded border border-slate-600 px-4 py-2 disabled:opacity-50" disabled={running} onClick={() => void runAssets()}>Check assets</button><button className="rounded border border-slate-600 px-4 py-2 disabled:opacity-50" disabled={!assets.length && !runtime.length} onClick={() => download("PROCTORING_RUNTIME_DIAGNOSTIC.json", JSON.stringify(report, null, 2))}>Export JSON</button><button className="rounded border border-slate-600 px-4 py-2 disabled:opacity-50" disabled={!assets.length && !runtime.length} onClick={() => download("PROCTORING_RUNTIME_DIAGNOSTIC.md", markdown())}>Export Markdown</button></div><section className="overflow-x-auto rounded border border-slate-700"><h2 className="border-b border-slate-700 px-4 py-3 text-lg font-semibold">Asset integrity</h2><table className="w-full min-w-[1300px] text-left text-xs"><thead className="bg-slate-900 text-slate-300"><tr>{["Asset / URL", "HTTP", "Content-Type", "Content-Length", "Actual bytes", "Expected SHA-256", "Actual SHA-256", "Header", "Result"].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{assets.map((asset) => <tr key={asset.id} className="border-t border-slate-800 align-top"><td className="px-3 py-2"><div>{asset.id}</div><code className="text-slate-400">{asset.url}</code></td><td className="px-3 py-2">{asset.status ?? "n/a"}</td><td className="px-3 py-2">{asset.contentType ?? "n/a"}</td><td className="px-3 py-2">{asset.contentLength ?? "n/a"}</td><td className="px-3 py-2">{asset.byteLength ?? "n/a"}</td><td className="px-3 py-2 break-all">{asset.expectedSha256}</td><td className="px-3 py-2 break-all">{asset.actualSha256 ?? "n/a"}</td><td className="px-3 py-2">{asset.header}</td><td className={`px-3 py-2 font-bold ${asset.result === "PASS" ? "text-emerald-400" : "text-red-400"}`}>{asset.result}{asset.rawError && <details className="mt-1 font-normal text-slate-300"><summary>Development detail</summary><pre className="mt-1 whitespace-pre-wrap">{asset.rawError}</pre></details>}</td></tr>)}</tbody></table>{!assets.length && <p className="p-4 text-sm text-slate-400">Run Asset integrity to populate this table.</p>}</section><section className="rounded border border-slate-700"><h2 className="border-b border-slate-700 px-4 py-3 text-lg font-semibold">Independent runtime initialization</h2><div className="divide-y divide-slate-800">{TESTS.map((test) => { const result = runtime.find((item) => item.test === test.id); return <div key={test.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm"><strong className="min-w-48">{test.label}</strong><span>{test.packageName}</span><button className="rounded border border-slate-600 px-3 py-1 text-xs disabled:opacity-50" disabled={running} onClick={() => void runTest(test.id)}>Run isolated test</button>{result && <><span className={result.result === "PASS" ? "text-emerald-400" : "text-red-400"}>{result.result}</span><span>Started {result.startedAt}</span><span>{result.durationMs?.toFixed(1) ?? "n/a"} ms</span><span>WASM: {result.wasmPath ?? "n/a"}</span>{result.modelPath && <span>Model: {result.modelPath} ({result.modelByteLength ?? "n/a"} bytes)</span>}{result.smokeInference && <span>{result.smokeInference}</span>}{result.sanitizedErrorCode && <span>Code: {result.sanitizedErrorCode}</span>}{result.rawError && <details><summary>Development detail</summary><pre className="mt-1 max-w-3xl whitespace-pre-wrap text-xs text-slate-300">{result.rawError}</pre></details>}</>}</div>; })}</div></section></div></main>;
}
