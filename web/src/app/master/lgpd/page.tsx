import { num, requireMaster, rpc, when } from "../data";
import { Badge, Metric, PageHead, StateBox, Table } from "../ui";

interface L { slaDays: number; summary: { pending: number; processed: number; overdue: number }; items: { userId: string; requestedAt: string; processedAt: string | null; status: string; daysOpen: number | null; overdue: boolean }[] }
export default async function Lgpd() {
  const sb = await requireMaster();
  const r = await rpc<L>(sb, "admin_lgpd_requests");
  return (
    <>
      <PageHead titulo="Solicitações LGPD" texto="Pedidos de exclusão de conta. O processamento é uma tarefa do servidor; o prazo de referência é de 15 dias." />
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <>
          <div className="adm-grid" style={{ marginBottom: 20 }}>
            <Metric rotulo="Pendentes" valor={num(r.data.summary.pending)} /><Metric rotulo="Atrasadas" valor={num(r.data.summary.overdue)} /><Metric rotulo="Processadas" valor={num(r.data.summary.processed)} />
          </div>
          <Table vazio="Nenhuma solicitação." cols={[{ k: "u", h: "Usuário" }, { k: "r", h: "Pedido em" }, { k: "s", h: "Situação" }, { k: "d", h: "Dias em aberto", num: true }]}
            rows={r.data.items.map((i) => ({ u: <code>{i.userId.slice(0, 8)}…</code>, r: when(i.requestedAt), s: <Badge s={i.status === "processado" ? "ok" : i.overdue ? "erro" : "aviso"}>{i.overdue ? "atrasada" : i.status}</Badge>, d: i.daysOpen ?? "—" }))} />
        </>
      )}
    </>
  );
}
