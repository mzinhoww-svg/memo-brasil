import { parsePeriod, type AccessStats, type OriginConversion, type WeeklyConversion } from "@/lib/master/access-stats";
import { MasterAcessosEstado, MasterAcessosView } from "@/revela/screens/MasterAcessos";
import { requireRole, rpc } from "../data";

/** Acessos · visitas, páginas, origem do tráfego, aparelhos e países (somente leitura; equipe da plataforma). */
export default async function Acessos({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const gate = await requireRole("acessos");
  if ("denied" in gate) return gate.denied;
  const period = parsePeriod((await searchParams).dias);
  const [r, conv, week] = await Promise.all([
    rpc<AccessStats>(gate.sb, "admin_access_stats", { p_days: period }),
    rpc<OriginConversion>(gate.sb, "admin_conversion_by_origin", { p_days: period }),
    rpc<WeeklyConversion>(gate.sb, "admin_conversion_weekly", { p_weeks: 8 }),
  ]);
  if (r.state !== "ok") return <MasterAcessosEstado variant={r.state === "denied" ? "denied" : "error"} />;
  if (r.data.totals.views === 0) return <MasterAcessosEstado variant="empty" />;
  return <MasterAcessosView stats={r.data} period={period} conversion={conv.state === "ok" && Array.isArray(conv.data?.rows) ? conv.data : null}
    weekly={week.state === "ok" && Array.isArray(week.data?.rows) ? week.data : null} />;
}
