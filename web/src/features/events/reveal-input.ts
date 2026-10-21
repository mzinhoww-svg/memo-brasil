import { defaultTimezone, validateRevealInput, MIN_REVEAL_LEAD_MS, isValidTimezone, type RevealErrors } from "@/domain/reveal";

export type RevealKind = "ao-terminar" | "depois" | "data";

/** Estado do formulário de revelação (wizard e configurações). */
export interface RevealInput {
  enabled: boolean;
  kind: RevealKind;
  days: number; // para "depois" (1 a 30)
  date: string; // YYYY-MM-DD no fuso escolhido (para "data")
  time: string; // HH:mm
  timezone: string;
}

export const defaultRevealInput = (): RevealInput => ({ enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: defaultTimezone() });

export type ResolvedReveal = { ok: true; enabled: false; at: null; timezone: string } | { ok: true; enabled: true; at: number; timezone: string } | { ok: false; errors: RevealErrors };

const DAY = 86_400_000;

/** Transforma o formulário em horário absoluto (UTC). `endMs` = fim do evento no momento da conta. */
export function resolveReveal(input: RevealInput, endMs: number, now: number): ResolvedReveal {
  const timezone = isValidTimezone(input.timezone) ? input.timezone : defaultTimezone();
  if (!input.enabled) return { ok: true, enabled: false, at: null, timezone };
  if (!isValidTimezone(input.timezone)) return { ok: false, errors: { fuso: "invalido" } };
  if (input.kind === "data") {
    const v = validateRevealInput({ date: input.date, time: input.time, timezone }, now);
    return v.at === undefined ? { ok: false, errors: v.errors } : { ok: true, enabled: true, at: v.at, timezone };
  }
  const at = input.kind === "ao-terminar" ? endMs : endMs + Math.min(30, Math.max(1, input.days)) * DAY;
  if (at < now + MIN_REVEAL_LEAD_MS) return { ok: false, errors: { data: "passado" } };
  return { ok: true, enabled: true, at, timezone };
}

export const REVEAL_ERROR_TEXT: Record<NonNullable<RevealErrors["data"] | RevealErrors["fuso"]>, string> = {
  invalida: "Escolha uma data e uma hora válidas.",
  passado: "Escolha um horário no futuro, pelo menos 1 minuto à frente.",
  invalido: "Esse fuso não existe. Escolha um da lista.",
};
