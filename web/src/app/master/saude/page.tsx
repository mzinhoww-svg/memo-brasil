import { healthAlerts } from "@/lib/master/health-alerts";
import { num, requireMaster, rpc, when } from "../data";
import { Badge, Metric, PageHead, StateBox, Table } from "../ui";

interface H { cronAvailable: boolean; jobs: { name: string; schedule: string; active: boolean; lastRun: { startedAt: string; status: string; message: string | null } | null }[]; reveals: { overdue: number; maxDelaySeconds: number }; purgeQueue: { size: number; oldestAgeSeconds: number }; uploads: { stalled: number; failed: number }; lgpd: { pendingDeletions: number } }
export default async function Saude() {
  const sb = await requireMaster();
  const r = await rpc<H>(sb, "admin_health");
  return (
    <>
      <PageHead titulo="Saúde operacional" texto="Tarefas agendadas, filas e atrasos medidos no banco." />
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <>
          {healthAlerts(r.data).map((a) => <div key={a.id} className="adm-state" role="alert" data-testid="alerta-saude">{a.text}</div>)}
          <div className="adm-grid" style={{ marginBottom: 20 }}>
            <Metric rotulo="Revelações atrasadas" valor={num(r.data.reveals.overdue)} nota={r.data.reveals.overdue ? `maior atraso ${Math.round(r.data.reveals.maxDelaySeconds / 60)} min` : undefined} />
            <Metric rotulo="Fila de limpeza" valor={num(r.data.purgeQueue.size)} />
            <Metric rotulo="Uploads parados (>1 h)" valor={num(r.data.uploads.stalled)} />
            <Metric rotulo="Exclusões LGPD pendentes" valor={num(r.data.lgpd.pendingDeletions)} />
          </div>
          {!r.data.cronAvailable ? <div className="adm-state" role="alert">pg_cron indisponível: as tarefas agendadas não estão rodando.</div> : (
            <Table vazio="Nenhuma tarefa mm-* registrada." cols={[{ k: "n", h: "Tarefa" }, { k: "c", h: "Agenda" }, { k: "a", h: "Ativa" }, { k: "l", h: "Última execução" }, { k: "s", h: "Resultado" }]}
              rows={r.data.jobs.map((j) => ({ n: j.name, c: <code>{j.schedule}</code>, a: <Badge s={j.active ? "ok" : "erro"}>{j.active ? "sim" : "não"}</Badge>, l: when(j.lastRun?.startedAt), s: j.lastRun ? <Badge s={j.lastRun.status === "succeeded" ? "ok" : "erro"}>{j.lastRun.status}</Badge> : "—" }))} />
          )}
        </>
      )}
    </>
  );
}
