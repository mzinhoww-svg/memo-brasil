import { startCheckout } from "@/features/billing/api";
import { idempotencyKeyFor } from "@/features/billing/flow";

export type AfterCreate = { kind: "checkout"; url: string } | { kind: "plan"; href: string };

/**
 * Evento recém-criado com plano pago escolhido no assistente: abre o pedido e leva direto ao Checkout Pro, sem pedir
 * a escolha do plano de novo. Qualquer falha cai na tela de plano com o plano pré-selecionado (nada se perde).
 */
export async function afterCreateDestination(
  eventId: string, planCode: string, start: typeof startCheckout = startCheckout, key: typeof idempotencyKeyFor = idempotencyKeyFor,
): Promise<AfterCreate> {
  const fallback: AfterCreate = { kind: "plan", href: `/painel/${eventId}/plano?plano=${encodeURIComponent(planCode)}` };
  try {
    const o = await start(eventId, planCode, key(eventId, planCode));
    if (o.planCode === planCode && (o.status === "criado" || o.status === "pendente") && o.checkoutUrl) return { kind: "checkout", url: o.checkoutUrl };
  } catch { /* cai na tela de plano */ }
  return fallback;
}
