import type { MemoEvent } from "@/domain/event";
import { splitMoment } from "@/domain/moments";

const tzOf = (e: Pick<MemoEvent, "timezone">) => e.timezone || "America/Cuiaba";
const part = (ts: number, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...o }).format(new Date(ts));

/** "SÁB 14 MAR": carimbo de data do evento no fuso dele. */
export function stampDay(ts: number, tz = "America/Cuiaba"): string {
  const wd = part(ts, tz, { weekday: "short" }).replace(".", "").toUpperCase();
  const d = part(ts, tz, { day: "2-digit" });
  const mo = part(ts, tz, { month: "short" }).replace(".", "").toUpperCase();
  return `${wd} ${d} ${mo}`;
}
export const hhmm = (ts: number, tz = "America/Cuiaba") => part(ts, tz, { hour: "2-digit", minute: "2-digit", hour12: false });

/** "Revela domingo, 12:00" */
export function revealLine(ts: number, tz = "America/Cuiaba"): string {
  return `Revela ${part(ts, tz, { weekday: "long" })}, ${hhmm(ts, tz)}`;
}

export function countdown(ms: number): { h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

/** Instante local (HH:MM no fuso do evento) na data do início; se for antes do início, vale o dia seguinte. */
export function momentInstant(e: Pick<MemoEvent, "startAt" | "timezone">, time: string): number {
  const tz = tzOf(e);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(e.startAt));
  const guess = (iso: string) => {
    // converte "aaaa-mm-ddThh:mm" no fuso tz para epoch, iterando pelo deslocamento
    const naive = Date.parse(iso + ":00Z");
    let t = naive;
    for (let i = 0; i < 2; i++) {
      const shown = Date.parse(new Intl.DateTimeFormat("sv-SE", { timeZone: tz, dateStyle: "short", timeStyle: "medium" }).format(new Date(t)).replace(" ", "T") + "Z");
      t += naive - shown;
    }
    return t;
  };
  const at = guess(`${day}T${time}`);
  return at < e.startAt ? at + 86_400_000 : at;
}

export type MomentState = "done" | "on" | "next";
/** Estado de cada momento da programação: o último que já começou está "on"; antes, "done"; depois, "next". */
export function momentStates(e: Pick<MemoEvent, "startAt" | "timezone" | "moments">, now: number): { time: string; name: string; state: MomentState }[] {
  const rows = e.moments.map(splitMoment).filter((m): m is { time: string; name: string } => !!m.time).map((m) => ({ ...m, at: momentInstant(e, m.time) })).sort((a, b) => a.at - b.at);
  const cur = rows.reduce((acc, m, i) => (m.at <= now ? i : acc), -1);
  return rows.map((m, i) => ({ time: m.time, name: m.name, state: i < cur ? "done" : i === cur ? "on" : "next" }));
}
