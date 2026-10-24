/** Transformações puras da página Saúde. */
import { humanCron, nextRun } from "@/features/master/cron";

export interface Run { startedAt: string; durationMs: number | null; status: string }
export interface JobHistory { name: string; schedule: string; active: boolean; runs: Run[]; consecutiveFailures: number }
export interface HealthHistory { cronAvailable: boolean; jobs: JobHistory[] }

/** Falhas seguidas que viram alerta. */
export const FAIL_STREAK_ALERT = 2;
export const RUNS_SHOWN = 24;

const isFail = (status: string) => status === "failed";
/** Falhas consecutivas a partir da corrida mais recente. */
export function failStreak(runs: readonly Run[]): number {
  let n = 0;
  for (const r of newestFirst(runs)) { if (isFail(r.status)) n++; else break; }
  return n;
}
const newestFirst = (runs: readonly Run[]) => runs.slice().sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));

/** Normaliza `admin_health_history`. */
export function toHistory(data: unknown): HealthHistory {
  const d = (data ?? {}) as { cronAvailable?: unknown; jobs?: unknown };
  const jobs = Array.isArray(d.jobs) ? (d.jobs as Partial<JobHistory>[]) : [];
  return {
    cronAvailable: d.cronAvailable !== false,
    jobs: jobs.map((j) => {
      const runs = Array.isArray(j.runs) ? j.runs : [];
      return { name: String(j.name ?? ""), schedule: String(j.schedule ?? ""), active: j.active !== false, runs, consecutiveFailures: typeof j.consecutiveFailures === "number" ? j.consecutiveFailures : failStreak(runs) };
    }),
  };
}

interface LegacyHealth { cronAvailable?: boolean; jobs?: { name: string; schedule: string; active: boolean; lastRun: { startedAt: string; status: string } | null }[] }
/** Sem `admin_health_history`: só a última execução de cada rotina (`admin_health`). */
export function historyFromLegacy(data: unknown): HealthHistory {
  const h = (data ?? {}) as LegacyHealth;
  return toHistory({
    cronAvailable: h.cronAvailable,
    jobs: (h.jobs ?? []).map((j) => ({ name: j.name, schedule: j.schedule, active: j.active, runs: j.lastRun ? [{ startedAt: j.lastRun.startedAt, durationMs: null, status: j.lastRun.status }] : [] })),
  });
}

export type RunTone = "ok" | "crit" | "dim";
export interface JobView {
  name: string;
  schedule: string;
  readable: string;
  next: Date | null;
  active: boolean;
  last: Run | null;
  lastTone: RunTone;
  /** Mais antiga à esquerda, mais recente à direita. */
  squares: { tone: RunTone; run: Run }[];
  streak: number;
  alert: boolean;
}
export const runTone = (status: string): RunTone => (status === "succeeded" ? "ok" : isFail(status) ? "crit" : "dim");

export function jobView(j: JobHistory, now: Date): JobView {
  const runs = newestFirst(j.runs).slice(0, RUNS_SHOWN);
  const last = runs[0] ?? null;
  const streak = Math.max(j.consecutiveFailures, failStreak(runs));
  return {
    name: j.name,
    schedule: j.schedule,
    readable: humanCron(j.schedule),
    next: j.active ? nextRun(j.schedule, now) : null,
    active: j.active,
    last,
    lastTone: last ? runTone(last.status) : "dim",
    squares: runs.slice().reverse().map((run) => ({ tone: runTone(run.status), run })),
    streak,
    alert: j.active && streak >= FAIL_STREAK_ALERT,
  };
}

/** "850 ms", "12 s", "2 min 5 s"; null vira "—". */
export function duration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
}
