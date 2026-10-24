/** Funções puras da página de pagamentos e planos (apresentação; nenhum dado novo, só agrupamentos das RPCs existentes). */

export interface OrderLite {
  orderId: string; createdAt: string; status: string; planCode: string; planName: string | null; amountCents: number;
  eventTitle?: string | null; providerPaymentId?: string | null; providerChargeId?: string | null;
}

export type EnvTone = "ok" | "warn" | "info";
/** O que cada ambiente de pagamento significa, em linguagem de operação. */
export function envInfo(env: string): { tone: EnvTone; title: string; text: string } {
  if (env === "production") return { tone: "ok", title: "Produção", text: "Cobranças reais. Todo pedido pago movimenta dinheiro e libera o plano." };
  if (env === "sandbox") return { tone: "warn", title: "Sandbox", text: "Modo de teste: pedidos com cartão de teste, sem dinheiro real. Clientes de verdade não conseguem pagar." };
  return { tone: "info", title: "Desligado", text: "Checkout fechado: ninguém consegue comprar plano. Só códigos de cortesia liberam planos." };
}

export interface StatusCount { count: number; amountCents: number }
export interface FunnelData { created: number; paid: number; pending: number; expired: number; other: number; paidRate: number | null }

const PAID_EVER = ["pago", "em_disputa", "estornado", "perdido"];
const OPEN = ["criado", "pendente"];
/** Funil criado → pago → expirado a partir de `byStatus` de admin_payments_summary. "Pago" inclui quem chegou a pagar (disputa e estorno). */
export function funnelFromStatus(byStatus: Record<string, StatusCount> | null | undefined): FunnelData {
  const by = byStatus ?? {};
  const n = (keys: string[]) => keys.reduce((s, k) => s + (by[k]?.count ?? 0), 0);
  const created = Object.values(by).reduce((s, v) => s + (v?.count ?? 0), 0);
  const paid = n(PAID_EVER), pending = n(OPEN), expired = n(["expirado"]);
  return { created, paid, pending, expired, other: Math.max(0, created - paid - pending - expired), paidRate: created > 0 ? paid / created : null };
}

export interface PlanSales { code: string; name: string; sales: number; revenueCents: number }
/** Vendas e receita por plano: só pedidos com status "pago" (estornados e em disputa não contam). Ordenado por receita. */
export function revenueByPlan(orders: readonly OrderLite[]): PlanSales[] {
  const map = new Map<string, PlanSales>();
  for (const o of orders) {
    if (o.status !== "pago") continue;
    const cur = map.get(o.planCode) ?? { code: o.planCode, name: o.planName ?? o.planCode, sales: 0, revenueCents: 0 };
    cur.sales += 1; cur.revenueCents += o.amountCents;
    map.set(o.planCode, cur);
  }
  return [...map.values()].sort((a, b) => b.revenueCents - a.revenueCents || a.name.localeCompare(b.name, "pt-BR"));
}

export const STALE_MS = 3_600_000;
/** Pedido pendente há mais de 1 h (mesmo critério de pendingOver1h do resumo). */
export function isStalePending(o: Pick<OrderLite, "status" | "createdAt">, nowMs: number): boolean {
  const t = Date.parse(o.createdAt);
  return o.status === "pendente" && Number.isFinite(t) && nowMs - t > STALE_MS;
}

/** Filtro por ?q=: id do pedido (ou parte), id de pagamento/cobrança ou título do evento. Vazio devolve tudo. */
export function matchOrders<T extends OrderLite>(orders: readonly T[], q: string | null | undefined): T[] {
  const s = (q ?? "").trim().toLowerCase();
  if (!s) return [...orders];
  return orders.filter((o) => [o.orderId, o.providerPaymentId, o.providerChargeId, o.eventTitle].some((v) => !!v && v.toLowerCase().includes(s)));
}
