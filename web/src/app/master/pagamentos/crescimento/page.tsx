import { MasterStatePage } from "@/revela/master";
import { MasterCrescimentoView } from "@/revela/screens/MasterCrescimento";
import { parseCohortPeriod, type GrowthCohort } from "@/features/growth/cohort";
import { requireRole, rpc } from "../../data";

/** GF-01: seção financeira só para Master. A RPC também verifica is_master() no banco. */
export default async function Crescimento({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const gate = await requireRole("pagamentos");
  if ("denied" in gate) return gate.denied;
  const period = parseCohortPeriod((await searchParams).dias);
  const result = await rpc<GrowthCohort>(gate.sb, "admin_growth_cohort", { p_days: period });
  if (result.state !== "ok") {
    return <MasterStatePage area="Funil de crescimento" variant={result.state === "denied" ? "denied" : "error"} />;
  }
  if (result.data.totals.created === 0) {
    return <MasterStatePage area="Funil de crescimento" variant="empty" title="Ainda sem eventos nesta coorte" text="Escolha um período maior ou acompanhe a criação de novos eventos." />;
  }
  return <MasterCrescimentoView stats={result.data} period={period} />;
}
