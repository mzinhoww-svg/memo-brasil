import { MIN_DURATION_HOURS } from "@/domain/options";
import { epochToZoned, zonedToEpoch } from "@/domain/reveal";

const HOUR = 3_600_000;
const HALF = 30 * 60_000;

export const addDays = (date: string, n: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Janela da festa (passo 3): dia + começa + termina, no fuso do evento. Termina ≤ começa = termina no dia seguinte (vira a meia-noite). */
export interface WindowInput { date: string; start: string; end: string; timezone: string }
export type WindowResult =
  | { ok: true; startMs: number; endMs: number; endsNextDay: boolean; endDate: string; hoursFromNow: number }
  | { ok: false; error: "invalida" | "curta" };

export function resolveWindow(i: WindowInput, now: number): WindowResult {
  const startMs = zonedToEpoch(i.date, i.start, i.timezone);
  if (!Number.isFinite(startMs) || !/^\d{2}:\d{2}$/.test(i.end)) return { ok: false, error: "invalida" };
  const endsNextDay = i.end <= i.start;
  const endDate = endsNextDay ? addDays(i.date, 1) : i.date;
  const endMs = zonedToEpoch(endDate, i.end, i.timezone);
  if (!Number.isFinite(endMs)) return { ok: false, error: "invalida" };
  const hoursFromNow = (endMs - now) / HOUR;
  if (hoursFromNow < MIN_DURATION_HOURS) return { ok: false, error: "curta" };
  return { ok: true, startMs, endMs, endsNextDay, endDate, hoursFromNow };
}

export const WINDOW_ERROR_TEXT = {
  invalida: "Escolha o dia e os horários da festa.",
  curta: "Escolha um horário no futuro, pelo menos 30 minutos a partir de agora.",
} as const;

/** Janela padrão: hoje, a partir da próxima meia hora cheia, por 6 horas. */
export function defaultWindow(now: number, timezone: string): WindowInput {
  const start = Math.ceil(now / HALF) * HALF;
  const s = epochToZoned(start, timezone);
  const e = epochToZoned(start + 6 * HOUR, timezone);
  return { date: s.date, start: s.time, end: e.time, timezone };
}

const WD = (epoch: number, tz: string, style: "short" | "long") => new Intl.DateTimeFormat("pt-BR", { weekday: style, timeZone: tz }).format(new Date(epoch)).replace(".", "");
/** "dom 02:00" */
export const shortWhen = (epoch: number, tz: string) => `${WD(epoch, tz, "short")} ${epochToZoned(epoch, tz).time}`;
/** "domingo, 15 de março" (com ano quando `year`) */
export function longDay(epoch: number, tz: string, year = false): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", ...(year ? { year: "numeric" } : {}), timeZone: tz }).format(new Date(epoch));
}

export type RevealChoiceId = "ao-acabar" | "manha" | "um-dia" | "dia";
export interface RevealOption { id: RevealChoiceId; label: string; at?: number }

/** Quatro opções do passo 5, calculadas a partir do fim da festa no fuso do evento. */
export function revealOptions(endMs: number, tz: string): RevealOption[] {
  const endZ = epochToZoned(endMs, tz);
  let noon = zonedToEpoch(endZ.date, "12:00", tz);
  if (noon <= endMs) noon = zonedToEpoch(addDays(endZ.date, 1), "12:00", tz);
  return [
    { id: "ao-acabar", label: "Quando a festa acabar", at: endMs },
    { id: "manha", label: "No dia seguinte", at: noon },
    { id: "um-dia", label: "Um dia depois", at: zonedToEpoch(addDays(endZ.date, 1), endZ.time, tz) },
    { id: "dia", label: "Escolher dia e hora" },
  ];
}

/** Duas datas civis em notação por extenso do aviso: "domingo, 15 de março, às 12:00". */
export function noticeLine(at: number, tz: string): string {
  return `${longDay(at, tz)}, às ${epochToZoned(at, tz).time}`;
}

/** Revelação escolhida precisa ser depois do fim da festa. */
export const REVEAL_BEFORE_END_TEXT = "A revelação precisa ser depois do fim da festa.";
