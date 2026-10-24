export interface CatalogPlan { code: string; name: string; capacity: number; priceCents: number }

/** Nome do plano pelo código; senão pela capacidade do catálogo; senão "manual (N)". */
export function planLabel(capacity: number | null | undefined, planCode: string | null | undefined, catalog: readonly CatalogPlan[]): string {
  const byCode = planCode ? catalog.find((p) => p.code === planCode) : undefined;
  if (byCode) return byCode.name;
  if (capacity == null) return "sem plano";
  const byCap = catalog.find((p) => p.capacity === capacity);
  return byCap ? byCap.name : `manual (${capacity})`;
}

/** Preço por convidado em centavos (arredondado); null sem capacidade válida. */
export function pricePerGuestCents(plan: Pick<CatalogPlan, "capacity" | "priceCents">): number | null {
  return plan.capacity > 0 ? Math.round(plan.priceCents / plan.capacity) : null;
}
