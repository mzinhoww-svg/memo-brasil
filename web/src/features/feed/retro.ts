import type { Photo, Reaction } from "@/domain/photo";
import { photoMoment, initialOf } from "./format";
import type { RetroBar, RetroShooter, RetroTile } from "@/revela/screens/FeedRetrospectiva";

const HOUR = 3_600_000;
const TEN_MIN = 600_000;
const hourLabel = (ts: number, tz: string) => `${Number(new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date(ts))) % 24}h`;
const clock = (ts: number, tz: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));

/** Números da retrospectiva (24h): fotógrafos, reações, pico de 10 minutos, fotos por hora e quem mais fotografou. */
export function retrospective(photos: Photo[], reactions: Reaction[], opts: { tz: string; shotsPerPerson: number | null; maxBars?: number; maxShooters?: number }): { tiles: RetroTile[]; bars: RetroBar[]; shooters: RetroShooter[] } {
  const maxBars = opts.maxBars ?? 8;
  const byAuthor = new Map<string, { name: string; n: number }>();
  const hours = new Map<number, number>();
  const tens = new Map<number, { n: number; moments: Map<string, number> }>();
  for (const p of photos) {
    const a = byAuthor.get(p.authorId) ?? { name: p.authorName, n: 0 };
    a.n += 1;
    byAuthor.set(p.authorId, a);
    const t = photoMoment(p);
    const h = Math.floor(t / HOUR);
    hours.set(h, (hours.get(h) ?? 0) + 1);
    const k = Math.floor(t / TEN_MIN);
    const w = tens.get(k) ?? { n: 0, moments: new Map() };
    w.n += 1;
    w.moments.set(p.moment, (w.moments.get(p.moment) ?? 0) + 1);
    tens.set(k, w);
  }
  const peak = [...tens.entries()].sort((a, b) => b[1].n - a[1].n || a[0] - b[0])[0];
  const peakMoment = peak ? [...peak[1].moments.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
  const tiles: RetroTile[] = [
    { label: "Fotógrafos", value: byAuthor.size.toLocaleString("pt-BR") },
    { label: "Reações", value: reactions.length.toLocaleString("pt-BR") },
    { label: "Pico", value: peak ? clock(peak[0] * TEN_MIN, opts.tz) : "–", note: peakMoment },
  ];
  const top = [...hours.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, maxBars).sort((a, b) => a[0] - b[0]);
  const max = Math.max(1, ...top.map(([, n]) => n));
  const bars: RetroBar[] = top.map(([h, n]) => ({ label: hourLabel(h * HOUR, opts.tz), pct: Math.max(4, Math.round((100 * n) / max)), on: n === max }));
  // só a primeira barra mais alta fica marcada
  let marked = false;
  for (const b of bars) { if (b.on && !marked) marked = true; else b.on = false; }
  const shooters: RetroShooter[] = [...byAuthor.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, opts.maxShooters ?? 3).map((a) => ({ avatar: initialOf(a.name), name: a.name, n: a.n, total: opts.shotsPerPerson }));
  return { tiles, bars, shooters };
}
