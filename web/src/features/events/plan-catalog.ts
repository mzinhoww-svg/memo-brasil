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
