import { isRevealed, type MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { photoMoment } from "@/features/feed/format";

/** Os prints da galeria (18): destaques primeiro, depois os mais reagidos, depois os mais recentes. */
export function pickGallery(photos: Photo[], reactions: Reaction[], opts: { n?: number; authorId?: string } = {}): Photo[] {
  const count = new Map<string, number>();
  for (const r of reactions) count.set(r.photoId, (count.get(r.photoId) ?? 0) + 1);
  return photos
    .filter((p) => p.status !== "removida" && p.uploadStatus === "pronta" && (!opts.authorId || p.authorId === opts.authorId))
    .sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || photoMoment(b) - photoMoment(a) || a.id.localeCompare(b.id))
    .slice(0, opts.n ?? 5);
}

/** Eventos já revelados, o mais recentemente revelado primeiro. */
export function revealedEvents(events: MemoEvent[], now: number): MemoEvent[] {
  const at = (e: MemoEvent) => e.revealedAt ?? e.revealAt ?? e.startAt;
  return events.filter((e) => isRevealed(e, now)).sort((a, b) => at(b) - at(a));
}

/** "hoje, 12:00", "ontem, 12:00" ou "14 mar, 12:00", no fuso do evento. */
export function whenLabel(ts: number, now: number, tz = "America/Cuiaba"): string {
  const day = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
  const hm = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
  if (day(ts) === day(now)) return `hoje, ${hm}`;
  if (day(ts) === day(now - 86_400_000)) return `ontem, ${hm}`;
  const d = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(ts)).replace(".", "").replace(" de ", " ");
  return `${d}, ${hm}`;
}
