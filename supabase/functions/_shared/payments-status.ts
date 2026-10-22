// Mapa do status do provedor (`transparent.status` da AbacatePay) para `public.payment_status` (plano, seção 3.1). Módulo puro.

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
