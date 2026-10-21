import type { CameraStyle, Capacity, EventCategory, RevealTiming, Shots } from "./options";
import { MIN_DURATION_HOURS } from "./options";

export type PaletteId = "salvia" | "terracota" | "oceano" | "ameixa";
export type EventFontId = "birthstone" | "pinyon" | "vibes";

export interface MemoEvent {
  id: string;
  code: string;
  title: string; // nome do casal/da festa (fonte do evento)
  category: EventCategory;
  hostId: string;
  hostName: string;
  startAt: number; // ms epoch
  durationHours: number;
  endedAt?: number; // "Encerrar agora"
  cameraStyle: CameraStyle;
  revealTiming: RevealTiming;
  revealDelayDays: number;
  capacity: Capacity;
  shotsPerPerson: Shots;
  everyoneSeesAll: boolean;
  reactionsEnabled: boolean;
  palette: PaletteId;
  eventFont: EventFontId;
  place?: string;
  moments: string[];
  tables: number;
  notice?: { text: string; expiresAt?: number };
  createdAt: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function endAt(e: Pick<MemoEvent, "startAt" | "durationHours" | "endedAt">): number {
  const planned = e.startAt + e.durationHours * HOUR;
  return e.endedAt !== undefined ? Math.min(e.endedAt, planned) : planned;
}

export function eventStatus(e: MemoEvent, now: number): "ativo" | "encerrado" {
  return now >= endAt(e) ? "encerrado" : "ativo";
}

/** Momento em que as fotos passam a ser vistas por todos. `durante` = na hora (INF: feed Agora do DS). */
export function revealAt(e: MemoEvent): number {
  if (e.revealTiming === "durante") return e.startAt;
  if (e.revealTiming === "ao-terminar") return endAt(e);
  return endAt(e) + e.revealDelayDays * DAY;
}

export function isRevealed(e: MemoEvent, now: number): boolean {
  return now >= revealAt(e);
}

/** Fotos restantes no rolo; `null` = ilimitado. */
export function shotsLeft(e: Pick<MemoEvent, "shotsPerPerson">, used: number): number | null {
  return e.shotsPerPerson === null ? null : Math.max(0, e.shotsPerPerson - used);
}

export type JoinResult = { ok: true } | { ok: false; reason: "lotado" | "encerrado" };

export function canJoin(e: MemoEvent, participantCount: number, now: number, alreadyMember: boolean): JoinResult {
  if (eventStatus(e, now) === "encerrado") return { ok: false, reason: "encerrado" };
  if (alreadyMember) return { ok: true };
  if (e.capacity !== null && participantCount >= e.capacity) return { ok: false, reason: "lotado" };
  return { ok: true };
}

/** Álbum encerrado com fotos não reabre (REA F-36). */
export function canEditEnd(e: MemoEvent, photoCount: number, now: number): boolean {
  return !(eventStatus(e, now) === "encerrado" && photoCount > 0);
}

export interface Draft {
  title: string;
  startAt: number;
  durationHours: number;
}
export type DraftErrors = { title?: "obrigatorio"; termino?: "curto" };

export function validateDraft(d: Draft, _now: number): DraftErrors {
  void _now;
  const errors: DraftErrors = {};
  if (!d.title.trim()) errors.title = "obrigatorio";
  if (d.durationHours < MIN_DURATION_HOURS) errors.termino = "curto";
  return errors;
}

/** A retrospectiva abre quando o evento terminou e as fotos foram reveladas (anfitrião vê sempre). */
export function retrospectiveOpen(e: MemoEvent, now: number, isHost: boolean): boolean {
  return isHost || (eventStatus(e, now) === "encerrado" && isRevealed(e, now));
}
