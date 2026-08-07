type MetricValue = string | number | boolean;

export type ProctoringMetric = {
  timestamp: number;
  detector: string;
  metric: string;
  values: Record<string, MetricValue>;
};

const MAX_METRICS = 500;
const enabled = import.meta.env.DEV && import.meta.env.VITE_PROCTORING_DEBUG_METRICS === "true";
const metrics: ProctoringMetric[] = [];

declare global {
  interface Window {
    __proctoringMetrics?: {
      enabled: boolean;
      get: () => ProctoringMetric[];
      summary: () => Record<string, { count: number; averageMs?: number; p95Ms?: number }>;
      clear: () => void;
    };
  }
}

function percentile(samples: number[], value: number) {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * value) - 1)];
}

function summary() {
  const grouped = new Map<string, number[]>();
  metrics.forEach((entry) => {
    const duration = entry.values.durationMs;
    if (typeof duration !== "number") return;
    const key = `${entry.detector}:${entry.metric}`;
    grouped.set(key, [...(grouped.get(key) ?? []), duration]);
  });
  const result: Record<string, { count: number; averageMs?: number; p95Ms?: number }> = {};
  grouped.forEach((durations, key) => {
    result[key] = {
      count: durations.length,
      averageMs: durations.reduce((total, duration) => total + duration, 0) / durations.length,
      ...(durations.length >= 20 ? { p95Ms: percentile(durations, 0.95) } : {}),
    };
  });
  return result;
}

export const proctoringDebugMetricsEnabled = enabled;

export function recordProctoringMetric(detector: string, metric: string, values: Record<string, MetricValue> = {}) {
  if (!enabled) return;
  metrics.push({ timestamp: Date.now(), detector, metric, values });
  if (metrics.length > MAX_METRICS) metrics.splice(0, metrics.length - MAX_METRICS);
}

export function installProctoringMetricsConsole() {
  if (!enabled || typeof window === "undefined") return;
  window.__proctoringMetrics = {
    enabled,
    get: () => metrics.map((entry) => ({ ...entry, values: { ...entry.values } })),
    summary,
    clear: () => { metrics.splice(0, metrics.length); },
  };
}

export function startMainThreadMetrics() {
  if (!enabled || typeof window === "undefined") return () => undefined;
  installProctoringMetricsConsole();
  let expected = performance.now() + 1_000;
  const timer = window.setInterval(() => {
    const now = performance.now();
    recordProctoringMetric("main-thread", "timer_drift", { durationMs: Math.max(0, now - expected) });
    expected += 1_000;
  }, 1_000);
  const observer = typeof PerformanceObserver === "undefined" ? null : new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => recordProctoringMetric("main-thread", "long_task", { durationMs: entry.duration }));
  });
  try { observer?.observe({ type: "longtask", buffered: true }); } catch { /* Long Task API is not available in every browser. */ }
  return () => { window.clearInterval(timer); observer?.disconnect(); };
}
