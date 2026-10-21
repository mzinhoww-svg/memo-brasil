import { FREE_GUEST_LIMIT, PLUS_GUEST_LIMIT, type Capacity } from "./options";

export type PriceRule = { kind: "gratis" } | { kind: "pago" } | { kind: "incluido" };

/** Regra do REA (E-10). Esta versão NÃO cobra: o "pago" é só informativo. */
export function priceRule(capacity: Capacity, plusActive: boolean): PriceRule {
  if (capacity !== null && capacity <= FREE_GUEST_LIMIT) return { kind: "gratis" };
  if (plusActive && capacity !== null && capacity <= PLUS_GUEST_LIMIT) return { kind: "incluido" };
  return { kind: "pago" };
}
