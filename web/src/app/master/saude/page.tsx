import { healthAlerts, type Health } from "@/lib/master/health-alerts";
import { MNote, MState } from "@/revela/master-kit";
import { MasterSaudeView, type ServicoRow } from "@/revela/screens/MasterSaude";
import { bytes, num, requireMaster, rpc } from "../data";
import { nowMs, relWhen } from "../format";

type H = Health & { lgpd: { pendingDeletions: number } };
interface M { storage: { photosBytes: number; photosObjects: number }; photos: { total: number } }
interface Ov { upcomingReveals: { revealAt: string | null }[]; readiness?: { paymentsEnv?: string; lastWebhookAt?: string | null } }
interface Rev { items: { emailsFailed: number }[] }

const ago = (iso: string) => {
  const min = Math.max(0, Math.round((nowMs() - Date.parse(iso)) / 60_000));
  return min < 60 ? `há ${min} min` : min < 2880 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dias`;
};

/** M11 · Storage e saúde: serviços e armazenamento medidos no banco. Cota de storage só aparece se o Master definir `storage_quota_bytes`. */
export default async function Saude() {
  const sb = await requireMaster();
  const t0 = nowMs();
  const [h, m, ov, rev, quota] = await Promise.all([
    rpc<H>(sb, "admin_health"), rpc<M>(sb, "admin_dashboard_metrics"), rpc<Ov>(sb, "admin_overview", { p_days: 7 }), rpc<Rev>(sb, "admin_reveals_board", { p_limit: 200 }),
    sb.from("platform_settings").select("value").eq("key", "storage_quota_bytes").maybeSingle(),
  ]);
  const latency = nowMs() - t0;
  if (h.state !== "ok") return <MState kind={h.state === "denied" ? "denied" : "error"} text={h.state === "error" ? `Não foi possível carregar: ${h.message}` : undefined} />;
  const hh = h.data;
  const failedMail = rev.state === "ok" ? rev.data.items.reduce((n, e) => n + e.emailsFailed, 0) : 0;
  const lastHook = ov.state === "ok" ? ov.data.readiness?.lastWebhookAt ?? null : null;
  const env = ov.state === "ok" ? ov.data.readiness?.paymentsEnv ?? "desligado" : "desligado";
  const next = ov.state === "ok" ? ov.data.upcomingReveals.find((r) => r.revealAt)?.revealAt ?? null : null;
  const badJobs = hh.jobs.filter((j) => !j.active || (j.lastRun && j.lastRun.status !== "succeeded")).length;
  const services: ServicoRow[] = [
    { key: "db", icon: "server", title: "Banco de dados", meta: `latência ${latency} ms`, tone: "ok", label: "Normal" },
    { key: "storage", icon: "photo", title: "Storage de fotos", meta: hh.uploads.stalled || hh.uploads.failed ? `${num(hh.uploads.stalled)} presas · ${num(hh.uploads.failed)} com falha` : "uploads em dia", tone: hh.uploads.stalled ? "wait" : "ok", label: hh.uploads.stalled ? "Atenção" : "Normal" },
    { key: "webhook", icon: "coin", title: "Webhook ValidaPay", meta: env === "desligado" ? "pagamentos desligados" : lastHook ? `último evento ${ago(lastHook)}` : "nenhum evento recebido ainda", tone: env === "desligado" || !lastHook ? "info" : "ok", label: env === "desligado" ? "Desligado" : lastHook ? "Normal" : "Sem eventos" },
    { key: "reveal", icon: "spark", title: "Fila de revelação", meta: hh.reveals.overdue ? `${hh.reveals.overdue} atrasada(s) · maior atraso ${Math.round(hh.reveals.maxDelaySeconds / 60)} min` : next ? `próxima ${relWhen(next)}` : "nada na fila", tone: hh.reveals.overdue ? "bad" : "ok", label: hh.reveals.overdue ? "Atrasada" : "Normal" },
    { key: "email", icon: "mail", title: "E-mail (Brevo)", meta: failedMail ? `${num(failedMail)} aviso(s) com falha` : "sem falhas", tone: failedMail ? "wait" : "ok", label: failedMail ? "Atenção" : "Normal" },
    { key: "jobs", icon: "clock", title: "Tarefas agendadas", meta: hh.cronAvailable ? `${hh.jobs.length} tarefas${badJobs ? ` · ${badJobs} com problema` : ""}` : "pg_cron indisponível", tone: !hh.cronAvailable ? "bad" : badJobs ? "wait" : "ok", label: !hh.cronAvailable ? "Parado" : badJobs ? "Atenção" : "Normal" },
  ];
  const used = m.state === "ok" ? m.data.storage.photosBytes : 0;
  const q = Number(quota.data?.value ?? 0);
  const gauges = [
    { label: "Fotos", value: q > 0 ? `${bytes(used)} de ${bytes(q)}` : bytes(used), pct: q > 0 ? (used / q) * 100 : 0, caption: `${m.state === "ok" ? num(m.data.storage.photosObjects) : "—"} arquivos · ${m.state === "ok" ? num(m.data.photos.total) : "—"} fotos prontas${q > 0 ? "" : " · sem cota definida"}` },
    { label: "Fila de exclusão", value: `${num(hh.purgeQueue.size)} ${hh.purgeQueue.size === 1 ? "item" : "itens"}`, pct: Math.min(100, hh.purgeQueue.size), caption: hh.purgeQueue.size ? `${hh.purgeQueue.size} ${hh.purgeQueue.size === 1 ? "arquivo aguardando" : "arquivos aguardando"} limpeza do storage` : "nada aguardando limpeza" },
  ];
  const alerts = healthAlerts(hh);
  return (
    <MasterSaudeView
      services={services} gauges={gauges}
      alerts={alerts.length ? <div className="stack" style={{ gap: "8px", marginBottom: "14px" }}>{alerts.map((a) => <div key={a.id} data-testid="alerta-saude"><MNote>{a.text}</MNote></div>)}</div> : undefined}
    />
  );
}
