/** Plano vigente do evento (RPC effective_entitlement, só anfitrião/Master). Modo local ou falha: Grátis (piso). */
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import type { PublicPlan } from "./types";

export async function currentPlanCode(eventId: string): Promise<string> {
  if (backendMode() !== "supabase") return "gratis";
  try {
    const r = await browserSupabase().rpc("effective_entitlement", { p_event: eventId });
    const rows = (r.data ?? []) as { plan_code?: string }[];
    return rows[0]?.plan_code ?? "gratis";
  } catch {
    return "gratis";
  }
}

/**
 * Plano vigente com nome e limites (RPC event_current_plan, só anfitrião/Master), inclusive um plano antigo que saiu do catálogo
 * público. Modo local ou falha: null (quem chama cai no catálogo e, por fim, no Grátis).
 */
export async function currentPlan(eventId: string): Promise<PublicPlan | null> {
  if (backendMode() !== "supabase") return null;
  try {
    const r = await browserSupabase().rpc("event_current_plan", { p_event: eventId });
    const d = r.data as { code?: unknown; name?: unknown; maxGuests?: unknown; maxShots?: unknown; priceCents?: unknown; isFree?: unknown } | null;
    if (r.error || !d || typeof d.code !== "string") return null;
    const n = (v: unknown) => (typeof v === "number" ? v : null);
    return { code: d.code, name: typeof d.name === "string" ? d.name : d.code, maxGuests: n(d.maxGuests), maxShots: n(d.maxShots), priceCents: n(d.priceCents) ?? 0, isFree: d.isFree === true, features: [] };
  } catch {
    return null;
  }
}
