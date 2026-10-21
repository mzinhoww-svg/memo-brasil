import type { MemoEvent } from "./event";

/**
 * Revelação programada (REA F-18, requisito do produto: câmera descartável).
 * Contrato espelhado no backend futuro: reveal_enabled, reveal_at (UTC), timezone (IANA), reveal_status.
 * Desligada = fotos visíveis na hora. Ligada = tudo bloqueado para convidados até `revealAt`.
 * A verdade é sempre `now >= revealAt`; `revealStatus` é o espelho persistido (idempotente) dessa conta.
 */
export type RevealStatus = "desativada" | "pendente" | "revelada";

export const MIN_REVEAL_LEAD_MS = 60_000;
export const DAY_MS = 86_400_000;

/** `fim`: revelação = fim do evento + N dias (acompanha o fim). `data`: instante fixo escolhido pelo organizador. */
export type RevealAnchor = "fim" | "data";
export interface RevealAnchorFields { revealAnchor: RevealAnchor; revealOffsetDays: number }

/** Para eventos salvos antes da âncora existir: deduz pela distância entre a revelação e o fim. */
export function inferRevealAnchor(e: { startAt: number; durationHours: number; endedAt?: number; revealEnabled: boolean; revealAt: number | null }): RevealAnchorFields {
  if (!e.revealEnabled || e.revealAt === null) return { revealAnchor: "data", revealOffsetDays: 0 };
  const planned = e.startAt + e.durationHours * 3_600_000;
  const end = e.endedAt !== undefined ? Math.min(e.endedAt, planned) : planned;
  const diff = e.revealAt - end;
  if (diff >= 0 && diff % DAY_MS === 0 && diff / DAY_MS <= 30) return { revealAnchor: "fim", revealOffsetDays: diff / DAY_MS };
  return { revealAnchor: "data", revealOffsetDays: 0 };
}

/**
 * Recalcula `revealAt` quando o fim do evento muda e a revelação está ancorada no fim. Nunca altera uma revelação
 * que já aconteceu (não se esconde de novo o que foi visto) nem uma data fixa.
 */
export function syncRevealWithEnd<T extends Pick<MemoEvent, "revealEnabled" | "revealAt" | "revealAnchor" | "revealOffsetDays" | "startAt" | "durationHours" | "endedAt">>(e: T, now: number): T {
  if (!e.revealEnabled || e.revealAnchor !== "fim") return e;
  if (computeRevealStatus(e, now) === "revelada") return e;
  const planned = e.startAt + e.durationHours * 3_600_000;
  const end = e.endedAt !== undefined ? Math.min(e.endedAt, planned) : planned;
  return { ...e, revealAt: end + e.revealOffsetDays * DAY_MS };
}

export const TIMEZONES: { id: string; label: string }[] = [
  { id: "America/Cuiaba", label: "Cuiabá (MT, UTC−4)" },
  { id: "America/Sao_Paulo", label: "Brasília e São Paulo (UTC−3)" },
  { id: "America/Manaus", label: "Manaus (AM, UTC−4)" },
  { id: "America/Fortaleza", label: "Fortaleza e Recife (UTC−3)" },
  { id: "America/Rio_Branco", label: "Rio Branco (AC, UTC−5)" },
  { id: "America/Noronha", label: "Fernando de Noronha (UTC−2)" },
  { id: "Europe/Lisbon", label: "Lisboa" },
  { id: "America/New_York", label: "Nova York" },
  { id: "UTC", label: "UTC" },
];

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function defaultTimezone(): string {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  return tz && isValidTimezone(tz) ? tz : "America/Cuiaba";
}

export function zoneLabel(tz: string): string {
  return TIMEZONES.find((z) => z.id === tz)?.label ?? tz;
}

/** Diferença (ms) entre a hora de parede no fuso e UTC no instante `at`. */
export function tzOffsetMs(tz: string, at: number): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(at / 1000) * 1000;
}

/** "2026-12-12" + "21:40" no fuso `tz` → epoch UTC. NaN se a data ou a hora forem inválidas. */
export function zonedToEpoch(date: string, time: string, tz: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t || !isValidTimezone(tz)) return NaN;
  const [y, m, day, h, mi] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  if (m < 1 || m > 12 || day < 1 || day > 31 || h > 23 || mi > 59) return NaN;
  const guess = Date.UTC(y, m - 1, day, h, mi);
  if (new Date(guess).getUTCDate() !== day) return NaN; // 31/02 etc.
  const first = guess - tzOffsetMs(tz, guess);
  return guess - tzOffsetMs(tz, first); // segunda passada: bordas de horário de verão
}

/** Epoch → campos de formulário no fuso. */
export function epochToZoned(epoch: number, tz: string): { date: string; time: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(epoch)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** "12 · 12 · 2026" e "21h40" no fuso do evento (padrão numérico do kit). */
export function formatInZone(epoch: number, tz: string): { date: string; time: string } {
  const z = epochToZoned(epoch, tz);
  const [y, m, d] = z.date.split("-");
  return { date: `${d} · ${m} · ${y}`, time: `${z.time.slice(0, 2)}h${z.time.slice(3)}` };
}

export function computeRevealStatus(e: Pick<MemoEvent, "revealEnabled" | "revealAt">, now: number): RevealStatus {
  if (!e.revealEnabled) return "desativada";
  if (e.revealAt === null) return "pendente";
  return now >= e.revealAt ? "revelada" : "pendente";
}

export type RevealErrors = { data?: "invalida" | "passado"; fuso?: "invalido" };

/** Valida data/hora/fuso digitados. O horário precisa estar pelo menos 1 minuto à frente. */
export function validateRevealInput(input: { date: string; time: string; timezone: string }, now: number): { errors: RevealErrors; at?: number } {
  if (!isValidTimezone(input.timezone)) return { errors: { fuso: "invalido" } };
  const at = zonedToEpoch(input.date, input.time, input.timezone);
  if (Number.isNaN(at)) return { errors: { data: "invalida" } };
  if (at < now + MIN_REVEAL_LEAD_MS) return { errors: { data: "passado" } };
  return { errors: {}, at };
}

export type RevealEditVerdict = { ok: true } | { ok: false; reason: "ja-revelada" | "fotos-ja-visiveis" };

/** O que o organizador pode mexer: nunca esconder de novo o que já foi visto (mesma lógica de "não reabrir"). */
export function canEditReveal(e: MemoEvent, photoCount: number, now: number, turningOn: boolean): RevealEditVerdict {
  if (computeRevealStatus(e, now) === "revelada") return { ok: false, reason: "ja-revelada" };
  if (turningOn && !e.revealEnabled && photoCount > 0) return { ok: false, reason: "fotos-ja-visiveis" };
  return { ok: true };
}

/** Texto da contagem regressiva: "2 d 03h 12min 05s". Não negativo. */
export function formatCountdown(ms: number): { text: string; parts: { d: number; h: number; m: number; s: number } } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return { text: `${d > 0 ? `${d} d ` : ""}${p(h)}h ${p(m)}min ${p(s)}s`, parts: { d, h, m, s } };
}

/** Evento antigo (revealTiming/revealDelayDays) → contrato novo. Usado pela migração v2 do IndexedDB. */
export interface LegacyRevealFields {
  startAt: number;
  durationHours: number;
  endedAt?: number;
  revealTiming?: "durante" | "ao-terminar" | "depois";
  revealDelayDays?: number;
  revealEnabled?: boolean;
}
export function migrateLegacyReveal<T extends LegacyRevealFields>(e: T, now: number, tz = defaultTimezone()): Omit<T, "revealTiming" | "revealDelayDays"> & { revealEnabled: boolean; revealAt: number | null; timezone: string; revealStatus: RevealStatus } {
  const { revealTiming, revealDelayDays, ...rest } = e;
  if (typeof e.revealEnabled === "boolean") return { ...rest, revealEnabled: e.revealEnabled, revealAt: (e as unknown as { revealAt: number | null }).revealAt ?? null, timezone: (e as unknown as { timezone?: string }).timezone ?? tz, revealStatus: computeRevealStatus({ revealEnabled: e.revealEnabled, revealAt: (e as unknown as { revealAt: number | null }).revealAt ?? null }, now) };
  const planned = e.startAt + e.durationHours * 3_600_000;
  const end = e.endedAt !== undefined ? Math.min(e.endedAt, planned) : planned;
  const enabled = revealTiming === "ao-terminar" || revealTiming === "depois";
  const at = !enabled ? null : revealTiming === "depois" ? end + (revealDelayDays ?? 1) * 86_400_000 : end;
  return { ...rest, revealEnabled: enabled, revealAt: at, timezone: tz, revealStatus: computeRevealStatus({ revealEnabled: enabled, revealAt: at }, now) };
}
