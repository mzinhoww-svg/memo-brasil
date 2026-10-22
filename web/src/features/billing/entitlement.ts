/** Plano vigente do evento (RPC effective_entitlement, só anfitrião/Master). Modo local ou falha: Grátis (piso). */
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";

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
