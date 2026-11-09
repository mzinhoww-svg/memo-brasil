import type { MemoEvent } from "@/domain/event";
import { computeRevealStatus } from "@/domain/reveal";
import { hhmm } from "@/features/guest/format";

const part = (ts: number, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...o }).format(new Date(ts));

/** "DOM 12:00": dia da semana curto e hora no fuso do evento. */
export const weekdayTime = (ts: number, tz: string) => `${part(ts, tz, { weekday: "short" }).replace(".", "").toUpperCase()} ${hhmm(ts, tz)}`;

/** Carimbo da revelação no topo do painel: "REVELA DOM 12:00", "REVELADA" ou "FOTOS NA HORA". */
export function revealStamp(e: MemoEvent, now: number): string {
  const st = computeRevealStatus(e, now);
  if (st === "desativada") return "FOTOS NA HORA";
  if (st === "revelada") return "REVELADA";
  return e.revealAt === null ? "REVELA NO FIM" : `REVELA ${weekdayTime(e.revealAt, e.timezone)}`;
}

/** "sáb, 14 mar, 23:59": data curta com hora, como nas linhas do desenho. */
export function shortWhen(ts: number, tz: string): string {
  const d = part(ts, tz, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  return `${d}, ${hhmm(ts, tz)}`;
}
