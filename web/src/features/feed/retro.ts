import type { EventCategory } from "@/domain/options";
import type { Photo, Reaction } from "@/domain/photo";
import { photoMoment, initialOf } from "./format";
import type { RetroBar, RetroShooter, RetroTile } from "@/revela/screens/FeedRetrospectiva";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TEN_MIN = 600_000;
/** Barras no máximo; passando disso, as horas se agrupam em blocos de 2, 3, 6, 12 ou 24 h. */
const MAX_BARS = 12;
/** Mínimo de barras quando o evento tem poucas horas: as vizinhas vazias dão contexto. */
const MIN_BARS = 5;
const GROUPS = [1, 2, 3, 6, 12, 24];

const partsFmt = new Map<string, Intl.DateTimeFormat>();
/** Deslocamento do fuso (ms) em um instante: relógio de parede − UTC. Funciona com fusos de 30 min. */
function offsetAt(ts: number, tz: string): number {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    partsFmt.set(tz, f);
  }
  const v: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ts))) if (p.type !== "literal") v[p.type] = Number(p.value);
  const wall = Date.UTC(v.year, v.month - 1, v.day, v.hour % 24, v.minute, v.second);
  return wall - Math.floor(ts / 1000) * 1000;
}
const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" });
const dayName = (hourIndex: number) => weekday.format(new Date(Math.floor(hourIndex / 24) * DAY)).replace(".", "");
const hourOfDay = (hourIndex: number) => ((hourIndex % 24) + 24) % 24;
const wallClock = (localMs: number) => {
  const m = ((Math.floor(localMs / 60_000) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Título da retrospectiva: artigo e substantivo da categoria + contagem de fotos. */
export function retroHeadline(category: EventCategory, photoCount: number): [string, string] {
  const noun: Record<EventCategory, string> = { casamento: "O casamento", festa: "A festa", empresa: "O evento", viagem: "A viagem", outro: "O evento" };
  return [noun[category] ?? "O evento", `em ${photoCount.toLocaleString("pt-BR")} ${photoCount === 1 ? "foto" : "fotos"}`];
}

export interface RetroOpts {
  tz: string;
  shotsPerPerson: number | null;
  maxShooters?: number;
  /** início e fim do evento: fotos fora de [início − 1 h, fim + 1 h] (relógio errado) entram na barra da ponta, sem esticar o gráfico. */
  window?: { start: number; end: number };
}

/** Números da retrospectiva (24h): fotógrafos, reações, pico de 10 minutos, fotos por hora (contínuas, no fuso do evento) e quem mais fotografou. */
export function retrospective(photos: Photo[], reactions: Reaction[], opts: RetroOpts): { tiles: RetroTile[]; bars: RetroBar[]; shooters: RetroShooter[] } {
  const lo = opts.window ? opts.window.start - HOUR : -Infinity;
  const hi = opts.window ? opts.window.end + HOUR : Infinity;
  const ids = new Set(photos.map((p) => p.id));
  const byAuthor = new Map<string, { name: string; n: number }>();
  const hours = new Map<number, number>();
  const tens = new Map<number, { n: number; moments: Map<string, number> }>();
  for (const p of photos) {
    const a = byAuthor.get(p.authorId) ?? { name: p.authorName, n: 0 };
    a.n += 1;
    byAuthor.set(p.authorId, a);
    const t = Math.min(hi, Math.max(lo, photoMoment(p)));
    const local = t + offsetAt(t, opts.tz);
    const h = Math.floor(local / HOUR);
    hours.set(h, (hours.get(h) ?? 0) + 1);
    const k = Math.floor(local / TEN_MIN);
    const w = tens.get(k) ?? { n: 0, moments: new Map() };
    w.n += 1;
    if (p.moment) w.moments.set(p.moment, (w.moments.get(p.moment) ?? 0) + 1);
    tens.set(k, w);
  }
  const peak = [...tens.entries()].sort((a, b) => b[1].n - a[1].n || a[0] - b[0])[0];
  // a nota só aparece quando um momento responde por mais da metade das fotos da janela
  const top = peak ? [...peak[1].moments.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] : undefined;
  const note = peak && top && top[1] * 2 > peak[1].n ? top[0] : undefined;
  const reactionCount = reactions.filter((r) => ids.has(r.photoId)).length;
  const tiles: RetroTile[] = [
    { label: "Fotógrafos", value: byAuthor.size.toLocaleString("pt-BR") },
    { label: "Reações", value: reactionCount.toLocaleString("pt-BR") },
    peak
      ? { label: "Pico (10 min)", value: `${wallClock(peak[0] * TEN_MIN)}–${wallClock((peak[0] + 1) * TEN_MIN)}`, range: true, ...(note ? { note } : {}) }
      : { label: "Pico (10 min)", value: "–" },
  ];
  return { tiles, bars: buildBars(hours), shooters: shooters(byAuthor, opts) };
}

function buildBars(hours: Map<number, number>): RetroBar[] {
  if (hours.size === 0) return [];
  const idx = [...hours.keys()];
  let first = Math.min(...idx);
  let last = Math.max(...idx);
  // poucas horas: vizinhas vazias só para contexto (depois, antes, depois...)
  for (let after = true; last - first + 1 < MIN_BARS; after = !after) { if (after) last += 1; else first -= 1; }
  const g = GROUPS.find((x) => Math.ceil((last - first + 1) / x) <= MAX_BARS) ?? 24;
  const start = g === 1 ? first : Math.floor(first / g) * g;
  const raw: { h: number; n: number }[] = [];
  for (let h = start; h <= last; h += g) {
    let n = 0;
    for (let i = h; i < h + g; i++) n += hours.get(i) ?? 0;
    raw.push({ h, n });
  }
  const max = Math.max(...raw.map((r) => r.n));
  const crossesDay = Math.floor(raw[0].h / 24) !== Math.floor((raw[raw.length - 1].h + g - 1) / 24);
  let marked = false;
  return raw.map(({ h, n }, i) => {
    const on = n > 0 && n === max && !marked;
    if (on) marked = true;
    const label = `${hourOfDay(h)}h`;
    const bar: RetroBar = { label, n, pct: n === 0 ? 0 : Math.max(8, Math.round((100 * n) / max)), on };
    if (g > 1) bar.range = `${label} às ${hourOfDay(h + g)}h`;
    if (hourOfDay(h) === 0 || (i === 0 && crossesDay)) bar.day = dayName(h);
    return bar;
  });
}

function shooters(byAuthor: Map<string, { name: string; n: number }>, opts: RetroOpts): RetroShooter[] {
  return [...byAuthor.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, opts.maxShooters ?? 3).map((a) => ({ avatar: initialOf(a.name), name: a.name, n: a.n, total: opts.shotsPerPerson }));
}
