import { endAt, type MemoEvent } from "./event";

export type NotificationKind = "ultima-chamada" | "fecha-em-breve" | "encerrou" | "revela-em-breve" | "revelou";
export interface PlannedNotification {
  kind: NotificationKind;
  at: number;
  title: string;
  body: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Agenda do REA (E-18): fim −1 dia, −1 h, −10 min, fim, revelação −10 min e revelação. Só horários futuros. */
export function notificationPlan(e: MemoEvent, now: number): PlannedNotification[] {
  const end = endAt(e);
  const reveal = e.revealEnabled && e.revealAt !== null ? e.revealAt : null;
  const all: PlannedNotification[] = [
    { kind: "fecha-em-breve", at: end - DAY, title: e.title, body: "O evento fecha em 1 dia." },
    { kind: "fecha-em-breve", at: end - HOUR, title: e.title, body: "O evento fecha em 1 hora." },
    { kind: "ultima-chamada", at: end - 10 * MIN, title: e.title, body: "Faltam 10 minutos para as últimas fotos." },
    { kind: "encerrou", at: end, title: e.title, body: reveal !== null && reveal <= end ? "O evento terminou. As fotos já podem ser vistas." : "O evento terminou." },
  ];
  if (reveal !== null) {
    all.push(
      { kind: "revela-em-breve", at: reveal - 10 * MIN, title: e.title, body: "As fotos aparecem em 10 minutos." },
      { kind: "revelou", at: reveal, title: e.title, body: "As fotos foram reveladas. Veja como ficou." },
    );
  }
  return all.filter((n) => n.at > now).sort((a, b) => a.at - b.at);
}
