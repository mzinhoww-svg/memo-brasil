import type { RevealInput } from "./reveal-input";
import { revealOptions, type RevealChoiceId } from "./wizard-time";

export type RevealChoice = RevealChoiceId;

/**
 * Traduz a escolha do passo 5 para o formulário de revelação existente (`resolveReveal` faz o resto).
 * Todas viram instante fixo (`data`), exceto "Quando a festa acabar", que acompanha o fim do evento.
 */
export function buildRevealInput(choice: RevealChoice, endMs: number, f: { date: string; time: string; timezone: string }): RevealInput {
  const base = { days: 1, timezone: f.timezone };
  if (choice === "ao-acabar") return { ...base, enabled: true, kind: "ao-terminar", date: "", time: "" };
  if (choice === "dia") return { ...base, enabled: true, kind: "data", date: f.date, time: f.time };
  const at = revealOptions(endMs, f.timezone).find((o) => o.id === choice)?.at ?? endMs;
  // data/hora no fuso do evento para o resolveReveal reconstruir o mesmo instante
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: f.timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(at));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { ...base, enabled: true, kind: "data", date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
