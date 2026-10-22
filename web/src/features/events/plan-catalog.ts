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

const KEY = "mm-codigo-pendente";

/** `/c/<código>` guarda o código (normalizado) para o assistente aplicar ao criar. Só nesta aba. */
export function savePendingCode(raw: string): void {
  const code = normalizeCode(raw.trim());
  if (!code) return;
  try { sessionStorage.setItem(KEY, code); } catch { /* sem storage: o código se perde, o evento é criado igual */ }
}
export function readPendingCode(): string | null {
  try { return sessionStorage.getItem(KEY) || null; } catch { return null; }
}
export function clearPendingCode(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* nada */ }
}
