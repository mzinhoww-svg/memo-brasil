// Mapa do status do provedor (`transparent.status` da AbacatePay) para `public.payment_status` (plano, seção 3.1). Módulo puro.
import { listPixCharges, type AbacateConfig, type PixListItem } from "./abacatepay.ts";

export type PaymentStatus = "criado" | "pendente" | "pago" | "expirado" | "cancelado" | "falhou" | "estornado" | "em_disputa" | "perdido";

const MAP: ReadonlyMap<string, PaymentStatus> = new Map([
  ["PENDING", "pendente"],
  ["PAID", "pago"],
  ["APPROVED", "pago"],
  ["EXPIRED", "expirado"],
  ["CANCELLED", "cancelado"],
  ["FAILED", "falhou"],
  ["REFUNDED", "estornado"],
  ["UNDER_DISPUTE", "em_disputa"],
]);

/**
 * Devolve o estado local ou `null` quando não se aplica (status desconhecido: o chamador registra divergência).
 * `REDEEMED` só vale como `pago` quando o valor informado é 0; sem valor ou com valor maior, é divergência (`null`).
 */
export function mapProviderStatus(s: string, amountCents?: number): PaymentStatus | null {
  if (s === "REDEEMED") return amountCents === 0 ? "pago" : null;
  return MAP.get(s) ?? null;
}

/**
 * A cobrança do provedor pertence a este pedido? Identidade por `externalId` OU `metadata.orderId` exatamente igual ao id
 * do pedido (a doc só garante externalId no webhook; metadata vem em create/get/list), mais o mesmo valor em centavos e o
 * mesmo ambiente (devMode ⇔ sandbox). Sem identidade, valor e ambiente, nada é adotado.
 */
export function chargeMatchesOrder(
  c: { externalId?: string | null; metadataOrderId?: string | null; amount?: number | null; devMode: boolean },
  order: { id: string; amount_cents: number; provider_env: "sandbox" | "production" },
): boolean {
  const identity = (typeof c.externalId === "string" && c.externalId === order.id) || (typeof c.metadataOrderId === "string" && c.metadataOrderId === order.id);
  return identity && c.amount === order.amount_cents && c.devMode === (order.provider_env === "sandbox");
}

const LIST_MAX_PAGES = 10;

/**
 * Procura a cobrança de um pedido 'criado' (create sem resposta ou attach que falhou) paginando GET /transparents/list:
 * startDate = dia (UTC) da criação menos 1 dia de margem (a API usa o fuso de São Paulo), method=PIX, externalId como
 * filtro auxiliar, cursor `after`, até 10 páginas de 100. Para quando o cursor some ou não avança. A correspondência é
 * sempre conferida aqui (chargeMatchesOrder). `complete=false` quando parou sem ter visto o fim da lista.
 */
export async function findChargeForOrder(
  cfg: AbacateConfig,
  order: { id: string; amount_cents: number; provider_env: "sandbox" | "production"; created_at: string },
  call: <T>(fn: () => Promise<T>) => Promise<T> = (fn) => fn(),
): Promise<{ charge: PixListItem | null; complete: boolean }> {
  const startDate = new Date(Date.parse(order.created_at) - 86_400_000).toISOString().slice(0, 10);
  let after: string | undefined;
  for (let i = 0; i < LIST_MAX_PAGES; i++) {
    const page = await call(() => listPixCharges(cfg, { startDate, after, limit: 100, externalId: order.id }));
    const hit = page.items.find((c) => chargeMatchesOrder(c, order));
    if (hit) return { charge: hit, complete: true };
    if (!page.next) return { charge: null, complete: true };
    if (page.next === after) return { charge: null, complete: false }; // cursor parado: não insiste
    after = page.next;
  }
  return { charge: null, complete: false };
}
