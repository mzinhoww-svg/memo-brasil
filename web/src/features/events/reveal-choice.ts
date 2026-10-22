import { epochToZoned } from "@/domain/reveal";
import type { RevealInput } from "./reveal-input";

export type RevealChoice = "na-hora" | "ao-acabar" | "manha" | "dia";

export const REVEAL_CHOICES: { value: RevealChoice; label: string }[] = [
  { value: "na-hora", label: "Na hora" },
  { value: "ao-acabar", label: "Quando acabar" },
  { value: "manha", label: "Na manhã seguinte (10h)" },
  { value: "dia", label: "Escolher dia" },
];

export const MORNING_TIME = "10:00";

const addDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * Traduz a escolha do passo "Quando" para o formulário de revelação existente (`resolveReveal` faz o resto).
 * "Manhã seguinte" = dia civil seguinte ao fim, às 10h, no fuso do evento.
 */
export function buildRevealInput(choice: RevealChoice, endMs: number, f: { date: string; time: string; timezone: string }): RevealInput {
  const base = { days: 1, timezone: f.timezone };
  if (choice === "na-hora") return { ...base, enabled: false, kind: "ao-terminar", date: "", time: "" };
  if (choice === "ao-acabar") return { ...base, enabled: true, kind: "ao-terminar", date: "", time: "" };
  if (choice === "manha") return { ...base, enabled: true, kind: "data", date: addDay(epochToZoned(endMs, f.timezone).date), time: MORNING_TIME };
  return { ...base, enabled: true, kind: "data", date: f.date, time: f.time };
}
