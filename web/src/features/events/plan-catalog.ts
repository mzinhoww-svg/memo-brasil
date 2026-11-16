import { normalizeCode } from "@/features/billing/api";
import type { PublicPlan } from "@/features/billing/types";

/** Funções puras sobre o catálogo recebido de `listPublicPlans()`. Nenhum valor é fixo no cliente. */
export const paidPlans = (plans: PublicPlan[]): PublicPlan[] => plans.filter((p) => !p.isFree);
export const hasPaidPlans = (plans: PublicPlan[]): boolean => plans.some((p) => !p.isFree);

export function lowestPaidPrice(plans: PublicPlan[]): number | undefined {
  const prices = paidPlans(plans).map((p) => p.priceCents);
  return prices.length ? Math.min(...prices) : undefined;
}

/** Limite de fotos por pessoa do Grátis, segundo o catálogo (padrão 10 se o catálogo não trouxer o Grátis). */
export const freeShots = (plans: PublicPlan[]): number => plans.find((p) => p.isFree)?.maxShots ?? 10;

/** Plano pago mais barato que comporta `shots` fotos por pessoa; `undefined` se o Grátis comporta ou não há plano pago. */
export function planForShots(plans: PublicPlan[], shots: number | null): PublicPlan | undefined {
  if (shots !== null && shots <= freeShots(plans)) return undefined;
  return paidPlans(plans).find((p) => p.maxShots === null || (shots !== null && p.maxShots >= shots));
}

/** Opções fixas do passo Poses (o 27 saiu: era um salto de R$ 59,90 para R$ 189 por 3 poses). "Livre" entra só se o catálogo tem plano sem limite. */
export const POSE_STEPS = [10, 24, 36] as const;
export const poseOptions = (plans: PublicPlan[]): (number | null)[] => [...POSE_STEPS, ...(paidPlans(plans).some((p) => p.maxShots === null) ? [null] : [])];

export type PoseOption = { n: number | null; caption: string; plan?: PublicPlan };

/**
 * Legenda de cada opção a partir do catálogo real: "Grátis" quando o Grátis comporta; "a partir de R$ x" com o plano pago mais barato
 * que comporta (`planForShots`); "indisponível" quando nenhum plano ativo comporta (pagamentos desligados). `money` formata centavos.
 */
export function poseOption(plans: PublicPlan[], n: number | null, money: (cents: number) => string): PoseOption {
  if (n !== null && n <= freeShots(plans)) return { n, caption: "Grátis" };
  const plan = planForShots(plans, n);
  return plan ? { n, caption: `a partir de ${money(plan.priceCents)}`, plan } : { n, caption: "indisponível" };
}

/** Aviso curto ao escolher acima do Grátis: "Isso muda seu plano para Festa." (nada quando o Grátis comporta ou não há plano). */
export function poseNotice(plans: PublicPlan[], n: number | null): string | null {
  const plan = n !== null && n <= freeShots(plans) ? undefined : planForShots(plans, n);
  return plan ? `Isso muda seu plano para ${plan.name}.` : null;
}

const KEY = "mm-codigo-pendente";
/** O código vale por 7 dias neste aparelho: sobrevive ao login com o Google (que pode voltar noutra aba ou no navegador do app). */
const PENDING_TTL_MS = 7 * 24 * 3_600_000;

/** `/c/<código>` guarda o código (normalizado) para o assistente aplicar ao criar. Fica no aparelho (não só na aba), com validade. */
export function savePendingCode(raw: string, now: number = Date.now()): void {
  const code = normalizeCode(raw.trim());
  if (!code) return;
  const value = JSON.stringify({ c: code, t: now });
  try { localStorage.setItem(KEY, value); } catch { /* sem armazenamento persistente */ }
  try { sessionStorage.setItem(KEY, value); } catch { /* sem storage: o código se perde, o evento é criado igual */ }
}
function parsePending(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { c?: unknown; t?: unknown };
    if (typeof v.c === "string" && typeof v.t === "number") return now - v.t <= PENDING_TTL_MS ? v.c : null;
  } catch { /* formato antigo: o código puro */ }
  return /^[A-Z0-9-]{4,64}$/.test(raw) ? raw : null;
}
export function readPendingCode(now: number = Date.now()): string | null {
  for (const store of ["localStorage", "sessionStorage"] as const) {
    try {
      const code = parsePending(window[store].getItem(KEY), now);
      if (code) return code;
    } catch { /* storage indisponível */ }
  }
  return null;
}
export function clearPendingCode(): void {
  try { localStorage.removeItem(KEY); } catch { /* nada */ }
  try { sessionStorage.removeItem(KEY); } catch { /* nada */ }
}
