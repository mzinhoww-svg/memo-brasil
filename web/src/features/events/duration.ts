const HOUR = 3_600_000;

/** Duração em horas a partir de um horário-alvo (`until`, ms) ou de um preset. Calculada no instante da criação. */
export function resolveDuration(input: { untilMs?: number; presetHours: number }, now: number): number {
  return input.untilMs !== undefined ? (input.untilMs - now) / HOUR : input.presetHours;
}
