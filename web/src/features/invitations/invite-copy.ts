import type { MemoEvent } from "@/domain/event";
import { computeRevealStatus, type RevealStatus } from "@/domain/reveal";
import type { EventPreview } from "@/repositories";
import { plural } from "@/lib/plural";

/** O que o convite precisa saber do evento (vem de `event_preview` ou do evento já carregado). */
export interface InviteFacts {
  shotsPerPerson: number | null;
  revealStatus: RevealStatus;
  revealAt: number | null;
  timezone: string;
  everyoneSeesAll: boolean;
  hostName: string;
}

export interface InviteLine { head: string; tail?: string }

/** Os mesmos fatos, a partir do evento completo (quem já entrou). */
export function factsFromEvent(e: MemoEvent, now: number): InviteFacts {
  return { shotsPerPerson: e.shotsPerPerson, revealStatus: computeRevealStatus(e, now), revealAt: e.revealAt, timezone: e.timezone, everyoneSeesAll: e.everyoneSeesAll, hostName: e.hostName };
}

/** Os mesmos fatos, a partir da prévia do convite (quem ainda não entrou). */
export function factsFromPreview(p: EventPreview): InviteFacts {
  return { shotsPerPerson: p.shotsPerPerson, revealStatus: p.revealStatus, revealAt: p.revealAt, timezone: p.timezone, everyoneSeesAll: p.everyoneSeesAll, hostName: p.hostName };
}

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function zoned(epoch: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(epoch));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour"), min: g("minute") };
}
const dayNumber = (z: { y: number; m: number; d: number }) => Math.round(Date.UTC(z.y, z.m - 1, z.d) / 86_400_000);

/**
 * Dia e hora da revelação no fuso do evento: "hoje", "amanhã", dia da semana (até 6 dias) ou dd/mm; hora "10h" ou "16h30".
 * `daysAhead` é a distância em dias civis (no fuso do evento). `weekdayForTomorrow` troca "amanhã" pelo dia da semana.
 */
export function revealDayTime(at: number, tz: string, now: number, opts: { weekdayForTomorrow?: boolean } = {}): { day: string; time: string; daysAhead: number } {
  const z = zoned(at, tz);
  const daysAhead = dayNumber(z) - dayNumber(zoned(now, tz));
  const pad = (n: number) => String(n).padStart(2, "0");
  const weekday = WEEKDAYS[new Date(Date.UTC(z.y, z.m - 1, z.d)).getUTCDay()];
  const day = daysAhead === 0 ? "hoje" : daysAhead === 1 && !opts.weekdayForTomorrow ? "amanhã" : daysAhead >= 1 && daysAhead < 7 ? weekday : `${pad(z.d)}/${pad(z.m)}`;
  return { day, time: z.min === 0 ? `${z.h}h` : `${z.h}h${pad(z.min)}`, daysAhead };
}

/** As três linhas do convite: fotos, revelação, quem vê. */
export function inviteLines(f: InviteFacts, now: number): [InviteLine, InviteLine, InviteLine] {
  const shots: InviteLine = { head: f.shotsPerPerson === null ? "Fotos sem limite." : `Você tem ${f.shotsPerPerson} ${plural(f.shotsPerPerson, "foto", "fotos")}.`, tail: "Escolha bem, como num filme." };
  let reveal: InviteLine;
  if (f.revealStatus === "desativada") reveal = { head: "As fotos aparecem na hora." };
  else if (f.revealStatus === "revelada") reveal = { head: "As fotos já foram reveladas." };
  else if (f.revealAt === null) reveal = { head: "Revela quando a festa terminar.", tail: `Até lá, só ${f.hostName} pode ver.` };
  else {
    const w = revealDayTime(f.revealAt, f.timezone, now);
    reveal = { head: `Revela ${w.day}, ${w.time}.`, tail: `Até lá, só ${f.hostName} pode ver.` };
  }
  const who: InviteLine = { head: "Quem vê:", tail: f.everyoneSeesAll ? `${f.hostName} e quem está na festa.` : `só ${f.hostName}.` };
  return [shots, reveal, who];
}

/** Complemento de "aparece para todos ___" na pré-permissão da câmera. */
export function cameraPromptWhen(f: InviteFacts, now: number): string {
  if (f.revealStatus === "desativada" || f.revealStatus === "revelada") return "na hora";
  if (f.revealAt === null) return "quando a festa terminar";
  const w = revealDayTime(f.revealAt, f.timezone, now);
  return `${w.day}, às ${w.time}`;
}
