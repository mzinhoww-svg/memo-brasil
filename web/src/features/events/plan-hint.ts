/**
 * PONTO DE EXTENSÃO DE BILLING: constante local com os limites APROVADOS (D1/D2), só para dar o selo de plano nas
 * opções do assistente. Quando o catálogo real (`listPublicPlans`) existir, troque o conteúdo deste módulo por ele.
 * Nada aqui cobra ou libera plano.
 */
export interface PlanHint {
  code: "festa" | "celebracao" | "casamento" | "grande";
  name: string;
  guests: number;
  /** `null` = fotos sem limite. */
  shots: number | null;
  priceBrl: number;
}

export const FREE_LIMITS = { guests: 10, shots: 10 } as const;

export const PLAN_HINTS: readonly PlanHint[] = [
  { code: "festa", name: "Festa", guests: 30, shots: 24, priceBrl: 29 },
  { code: "celebracao", name: "Celebração", guests: 100, shots: 24, priceBrl: 89 },
  { code: "casamento", name: "Casamento", guests: 250, shots: 36, priceBrl: 189 },
  { code: "grande", name: "Grande", guests: 500, shots: null, priceBrl: 349 },
];

/** Plano mais barato que comporta `shots` fotos por pessoa; `undefined` se o Grátis já comporta. */
export function planHintForShots(shots: number | null): PlanHint | undefined {
  if (shots !== null && shots <= FREE_LIMITS.shots) return undefined;
  return PLAN_HINTS.find((p) => p.shots === null || (shots !== null && p.shots >= shots));
}

export const shotsOptionHint = (shots: number | null): string | undefined => planHintForShots(shots)?.name;
