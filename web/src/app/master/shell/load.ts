import "server-only";
import { cache } from "react";
import { shellFromSignals, signalsFromLegacy, signalsFromOverview, type ShellState } from "@/features/master/alerts";
import type { masterAccess } from "@/lib/master/server";
import { rpcOr } from "../data";

type Sb = NonNullable<Awaited<ReturnType<typeof masterAccess>>["sb"]>;
export type Shell = ShellState & { degraded: boolean };

const EMPTY: Shell = { alerts: [], badges: {}, degraded: false };

/** Resultado de uma RPC só de leitura, ou `null` se falhar (o shell nunca derruba a página). */
async function read(sb: Sb, name: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    const { data, error } = await sb.rpc(name, args ?? {});
    return error ? null : data;
  } catch {
    return null;
  }
}

/**
 * Badges do menu + barra de alertas, uma vez por requisição. Usa `admin_overview` (30 dias, sem testes);
 * sem ela no banco, compõe as RPCs antigas, todas só de leitura (nenhuma mutação de pagamentos).
 */
export const loadShell = cache(async (sb: Sb): Promise<Shell> => {
  try {
    // Sem admin_overview, `data` é a saída de admin_dashboard_metrics (degraded: true).
    const first = await rpcOr<unknown>(sb, "admin_overview", { p_days: 30, p_include_tests: false }, { name: "admin_dashboard_metrics" });
    if (first.state !== "ok") return EMPTY;
    if (!first.degraded) return { ...shellFromSignals(signalsFromOverview(first.data)), degraded: false };

    const metrics = first.data;
    const [lgpd, health, payments, settings] = await Promise.all([
      read(sb, "admin_lgpd_requests", { p_limit: 1 }),
      read(sb, "admin_health"),
      read(sb, "admin_payments_summary"),
      read(sb, "get_public_settings"),
    ]);
    return { ...shellFromSignals(signalsFromLegacy({ metrics, lgpd, health, payments, settings })), degraded: true };
  } catch {
    return EMPTY;
  }
});
