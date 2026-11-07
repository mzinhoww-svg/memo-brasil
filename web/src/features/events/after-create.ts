import { validapayCheckoutEnabled } from "@/features/billing/checkout-provider";
import { startCheckout } from "@/features/billing/api";
import { idempotencyKeyFor } from "@/features/billing/flow";

export type AfterCreate = { kind: "checkout"; url: string } | { kind: "plan"; href: string };

/**
 * Evento recém-criado: mantém o plano escolhido e usa o mesmo provedor do painel.
 * O checkout transparente reserva seu próprio pedido; somente o fluxo legado abre Checkout Pro aqui.
 */
export async function afterCreateDestination(
  eventId: string, planCode: string, start: typeof startCheckout = startCheckout, key: typeof idempotencyKeyFor = idempotencyKeyFor,
): Promise<AfterCreate> {
  if (validapayCheckoutEnabled()) return {
    kind: "plan", href: `/painel/${encodeURIComponent(eventId)}/checkout-validapay?plano=${encodeURIComponent(planCode)}`,
  };
  const fallback: AfterCreate = { kind: "plan", href: `/painel/${eventId}/plano?plano=${encodeURIComponent(planCode)}` };
  try {
    const o = await start(eventId, planCode, key(eventId, planCode));
    if (o.planCode === planCode && (o.status === "criado" || o.status === "pendente") && o.checkoutUrl) return { kind: "checkout", url: o.checkoutUrl };
  } catch { /* cai na tela de plano */ }
  return fallback;
}
