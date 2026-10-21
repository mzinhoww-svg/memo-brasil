/**
 * Relógio com correção do servidor. A verdade sobre "agora" (revelação, fim do evento) é o relógio do servidor; o do
 * aparelho só avança entre duas sincronizações. Sem sincronizar, o deslocamento é 0 e vale o aparelho (demo local).
 */
export const SKEW_LIMIT_MS = 2 * 60_000;

export interface ServerClock {
  now(): number;
  /** Informa o horário do servidor recebido quando o relógio do aparelho marcava `deviceAt`. */
  sync(serverNow: number, deviceAt?: number): void;
  offset(): number;
  /** O aparelho está desregulado a ponto de poder enganar quem confia nele. */
  skewed(): boolean;
}

export function createServerClock(opts: { read?: () => number } = {}): ServerClock {
  const read = opts.read ?? Date.now;
  let offset = 0;
  return {
    now: () => read() + offset,
    sync: (serverNow, deviceAt = read()) => void (offset = serverNow - deviceAt),
    offset: () => offset,
    skewed: () => Math.abs(offset) > SKEW_LIMIT_MS,
  };
}
