/** Transformações puras da página Analytics (séries, comparação de períodos, coortes semanais). */

export const TZ = "America/Cuiaba";

export interface DayPoint { day: string; eventsCreated: number; joins: number; photos: number }
export type Metric = "photos" | "joins" | "eventsCreated";
export const METRICS: { key: Metric; label: string }[] = [
  { key: "photos", label: "Fotos" },
  { key: "joins", label: "Entradas" },
  { key: "eventsCreated", label: "Eventos criados" },
];
export const metricOf = (v: string | string[] | undefined): Metric => {
  const s = Array.isArray(v) ? v[0] : v;
  return METRICS.some((m) => m.key === s) ? (s as Metric) : "photos";
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** `admin_overview.series` → pontos diários. */
export function fromOverview(series: unknown): DayPoint[] {
  if (!Array.isArray(series)) return [];
  return series.map((d: Record<string, unknown>) => ({ day: str(d.day).slice(0, 10), eventsCreated: n(d.eventsCreated), joins: n(d.joins), photos: n(d.photos) }));
}

/** `admin_dashboard_metrics.series` (formato antigo) → pontos diários. */
export function fromLegacy(series: unknown): DayPoint[] {
  if (!Array.isArray(series)) return [];
  return series.map((d: Record<string, unknown>) => ({ day: str(d.day).slice(0, 10), eventsCreated: n(d.eventsCreated), joins: n(d.participantsJoined), photos: n(d.photosUploaded) }));
}

/** Divide uma série de 2N dias em período atual (últimos N) e anterior (N antes). Falta de dias vira zero à esquerda. */
export function splitPeriods(series: readonly DayPoint[], days: number): { current: DayPoint[]; previous: DayPoint[] } {
  const sorted = [...series].sort((a, b) => a.day.localeCompare(b.day));
  const current = sorted.slice(-days);
  const before = sorted.slice(0, Math.max(0, sorted.length - days)).slice(-days);
  const pad: DayPoint[] = Array.from({ length: days - before.length }, () => ({ day: "", eventsCreated: 0, joins: 0, photos: 0 }));
  return { current, previous: [...pad, ...before] };
}

export const total = (pts: readonly DayPoint[], m: Metric) => pts.reduce((s, p) => s + p[m], 0);

/** Soma acumulada. */
export function cumulative(values: readonly number[]): number[] {
  let s = 0;
  return values.map((v) => (s += v));
}

/** "2026-10-23" → "23/10". */
export const shortDay = (day: string) => (day.length >= 10 ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : day);

// ---------------------------------------------------------------- coortes semanais

/** Data local (YYYY-MM-DD) de um instante no fuso de Cuiabá. */
export function localDay(iso: string | number | Date, tz = TZ): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
}

/** Segunda-feira (YYYY-MM-DD) da semana de uma data local. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** As `count` segundas mais recentes até a semana de `now` (mais antiga primeiro). */
export function lastWeeks(now: number | Date, count: number, tz = TZ): string[] {
  const first = weekStart(localDay(now, tz));
  const base = new Date(`${first}T12:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - 7 * (count - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

/** Semanas de coorte para o período: 7 dias = 2, 30 = 5, 90 = 13. */
export const cohortWeeks = (days: number) => Math.min(13, Math.max(2, Math.ceil(days / 7)));

export interface CohortEvent { createdAt: string; participants: number; photos: number }
export interface CohortRow { week: string; created: number; withParticipant: number; withPhoto: number }

/** Eventos criados em cada semana → com pelo menos um participante → com pelo menos uma foto pronta. */
export function cohorts(events: readonly CohortEvent[], weeks: readonly string[], tz = TZ): CohortRow[] {
  const rows = new Map(weeks.map((w) => [w, { week: w, created: 0, withParticipant: 0, withPhoto: 0 }]));
  for (const e of events) {
    if (!e.createdAt) continue;
    const r = rows.get(weekStart(localDay(e.createdAt, tz)));
    if (!r) continue;
    r.created++;
    if (e.participants > 0) r.withParticipant++;
    if (e.photos > 0) r.withPhoto++;
  }
  return weeks.map((w) => rows.get(w)!);
}

/** Item de `admin_list_events_v2`/`admin_list_events` → evento de coorte. */
export function cohortEvent(x: Record<string, unknown>): CohortEvent {
  return { createdAt: str(x.createdAt), participants: n(x.participants), photos: n(x.photos) };
}

/** Semanas de coorte do período até agora e o início (ms) da mais antiga; fora do componente (renderização pura). */
export function cohortRange(days: number, now: number = Date.now()): { weeks: string[]; sinceMs: number } {
  const weeks = lastWeeks(now, cohortWeeks(days));
  return { weeks, sinceMs: Date.parse(`${weeks[0]}T00:00:00-04:00`) }; // Cuiabá: UTC-4 fixo, sem horário de verão
}

/** Rótulo da semana: "20/10 a 26/10". */
export function weekLabel(week: string): string {
  const d = new Date(`${week}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return `${shortDay(week)} a ${shortDay(d.toISOString().slice(0, 10))}`;
}
