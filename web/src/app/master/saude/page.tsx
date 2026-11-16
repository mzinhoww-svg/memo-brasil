import { healthAlerts, type Health } from "@/lib/master/health-alerts";
import { gaugeRows, growthBars, growthTotal, jobRows, type HistoryJob, type StorageData } from "@/lib/master/health";
import { MNote } from "@/revela/master-kit";
import { MasterSaudeCompletaEstado, MasterSaudeCompletaView, type ServiceChip } from "@/revela/screens/MasterSaudeCompleta";
import { requireRole, rpc } from "../data";
import { nowMs, relWhen } from "../format";

type H = Health & { generatedAt?: string; lgpd: { pendingDeletions: number } };
interface Ov { upcomingReveals: { revealAt: string | null }[]; readiness?: { paymentsEnv?: string; lastWebhookAt?: string | null } }
interface Rev { items: { emailsFailed: number }[] }
const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Cuiaba", hour: "2-digit", minute: "2-digit" });

/** M27 · Storage e saúde (somente leitura): serviços, armazenamento e crescimento por dia, jobs agendados com as últimas 8 execuções.
 *  Abre para master, support e auditor (as RPCs aceitam a equipe). Cota de fotos só aparece se o master definir `storage_quota_bytes`. */
export default async function Saude() {
  const gate = await requireRole("saude");
  if ("denied" in gate) return gate.denied;
  const { sb } = gate;
  const t0 = nowMs();
  const [h, hist, st, ov, rev] = await Promise.all([
    rpc<H>(sb, "admin_health"), rpc<{ cronAvailable: boolean; jobs: HistoryJob[] }>(sb, "admin_health_history", { p_limit: 8 }), rpc<StorageData>(sb, "admin_storage_breakdown"),
    rpc<Ov>(sb, "admin_overview", { p_days: 7 }), rpc<Rev>(sb, "admin_reveals_board", { p_limit: 200 }),
  ]);
  const latency = nowMs() - t0;
  if (h.state !== "ok" || hist.state !== "ok" || st.state !== "ok") {
    const denied = [h, hist, st].some((r) => r.state === "denied");
    return <MasterSaudeCompletaEstado variant={denied ? "denied" : "error"} />;
  }
  const hh = h.data, s = st.data;
  const caption = `Situação dos serviços agora · atualizado às ${hm(s.generatedAt ?? hh.generatedAt ?? new Date(nowMs()).toISOString())}`;
  const nothingYet = hh.cronAvailable && hist.data.jobs.every((j) => j.runs.length === 0) && s.totalBytes === 0;
  if (nothingYet) return <MasterSaudeCompletaEstado variant="empty" caption={caption} />;
  const failedMail = rev.state === "ok" ? rev.data.items.reduce((n, e) => n + e.emailsFailed, 0) : 0;
  const lastHook = ov.state === "ok" ? ov.data.readiness?.lastWebhookAt ?? null : null;
  const env = ov.state === "ok" ? ov.data.readiness?.paymentsEnv ?? "desligado" : "desligado";
  const chips: ServiceChip[] = [
    { key: "db", label: "Banco", tone: latency > 2000 ? "wait" : "ok", status: latency > 2000 ? "Lento" : "Normal" },
    { key: "storage", label: "Storage", tone: hh.uploads.stalled ? "wait" : "ok", status: hh.uploads.stalled ? "Atenção" : "Normal" },
    { key: "webhook", label: "Webhook ValidaPay", tone: env === "desligado" || !lastHook ? "info" : "ok", status: env === "desligado" ? "Desligado" : lastHook ? "Normal" : "Sem eventos" },
    { key: "reveal", label: "Fila de revelação", tone: hh.reveals.overdue ? "bad" : "ok", status: hh.reveals.overdue ? "Atrasada" : "Normal" },
    { key: "email", label: "E-mail", tone: failedMail ? "wait" : "ok", status: failedMail ? "Atenção" : "Normal" },
  ];
  const alerts = healthAlerts(hh);
  return (
    <MasterSaudeCompletaView
      caption={caption} chips={chips} gauges={gaugeRows(s)} bars={growthBars(s.growth)} growth={growthTotal(s.growth)} jobs={jobRows(hist.data.jobs, (iso) => relWhen(iso), 8)}
      alerts={alerts.length ? <div className="stack" style={{ gap: "8px", marginBottom: "14px" }}>{alerts.map((a) => <div key={a.id} data-testid="alerta-saude"><MNote>{a.text}</MNote></div>)}</div> : undefined}
    />
  );
}
