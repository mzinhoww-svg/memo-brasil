import { pricePerGuestCents } from "@/features/master/plan";
import type { PlanSales } from "../pagamentos/lib";

export interface PlanLite { code: string; name: string; maxGuests: number | null; priceCents: number; isFree: boolean }
export interface PlanView extends PlanLite { perGuestCents: number | null; sales: number; revenueCents: number }

/** Junta plano, preço por convidado e vendas/receita (pedidos pagos). Plano sem venda fica com zero. */
export function planViews<P extends PlanLite>(plans: readonly P[], sales: readonly PlanSales[]): (P & Pick<PlanView, "perGuestCents" | "sales" | "revenueCents">)[] {
  const by = new Map(sales.map((s) => [s.code, s]));
  return plans.map((p) => ({
    ...p,
    perGuestCents: p.isFree || p.maxGuests == null ? null : pricePerGuestCents({ capacity: p.maxGuests, priceCents: p.priceCents }),
    sales: by.get(p.code)?.sales ?? 0,
    revenueCents: by.get(p.code)?.revenueCents ?? 0,
  }));
}
