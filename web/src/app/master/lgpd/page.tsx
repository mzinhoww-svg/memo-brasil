import { num, requireMaster, rpc, when } from "../data";
import { PageHead, StateBox } from "../ui";
import { BarLineChart } from "../kit/BarLineChart";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Kpi } from "../kit/Kpi";
import { Meter } from "../kit/Meter";
import { Pill } from "../kit/Pill";
import { monthlyHistory, slaOf, sortBySla, type LgpdItem } from "./lib";
import s from "./page.module.css";

interface L { slaDays: number; summary: { pending: number; processed: number; overdue: number }; items: LgpdItem[] }

export default async function Lgpd() {
  const sb = await requireMaster();
  const r = await rpc<L>(sb, "admin_lgpd_requests", { p_limit: 500 });
  if (r.state !== "ok") return (<><PageHead titulo="Solicitações LGPD" /><StateBox load={r} /></>);

  const { slaDays, summary } = r.data;
  const items = sortBySla(r.data.items, slaDays);
  const hist = monthlyHistory(r.data.items, slaDays);
  const csvRows = items.map((i) => {
    const sla = slaOf(i, slaDays);
    return { usuario: i.userId, pedido: i.requestedAt, concluido: i.processedAt ?? "", situacao: sla.late ? "atrasada" : i.status, dias: sla.used, prazo: slaDays };
  });
  const histCsv = hist.map((h) => ({ mes: h.month, pedidos: h.requested, concluidos: h.processed, atrasadas: h.late }));

  return (
    <>
      <PageHead titulo="Solicitações LGPD" texto={`Pedidos de exclusão de conta. O processamento é uma tarefa do servidor; o prazo de resposta é de ${slaDays} dias.`} />
      <div className={s.kpis}>
        <Kpi label="Pendentes" value={num(summary.pending)} />
        <Kpi label="Atrasadas" value={num(summary.overdue)} note={summary.overdue ? "Além do prazo" : "Nenhuma além do prazo"} />
        <Kpi label="Processadas" value={num(summary.processed)} />
      </div>

      <h2 className={s.sec}>Prazo por solicitação</h2>
      <div className={s.tools}><CsvButton filename="lgpd-solicitacoes" rows={csvRows} cols={[{ key: "usuario", label: "Usuário" }, { key: "pedido", label: "Pedido em" }, { key: "concluido", label: "Concluído em" }, { key: "situacao", label: "Situação" }, { key: "dias", label: "Dias usados" }, { key: "prazo", label: "Prazo (dias)" }]} /></div>
      {items.length === 0 ? (
        <EmptyState title="Nenhuma solicitação" text="Quando alguém pedir a exclusão da conta, o pedido aparece aqui com a contagem do prazo." />
      ) : (
        <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Solicitações LGPD">
          <table className="adm-table">
            <thead><tr><th scope="col">Usuário</th><th scope="col">Pedido em</th><th scope="col">Situação</th><th scope="col">Prazo usado</th></tr></thead>
            <tbody>{items.map((i) => {
              const sla = slaOf(i, slaDays);
              return (
                <tr key={`${i.userId}-${i.requestedAt}`} className={!sla.done && sla.late ? s.late : undefined}>
                  <td><code title={i.userId}>{i.userId.slice(0, 8)}…</code></td>
                  <td>{when(i.requestedAt)}</td>
                  <td>{sla.done ? <Pill tone={sla.late ? "crit" : "ok"}>{sla.late ? "processada fora do prazo" : "processada"}</Pill> : sla.late ? <Pill tone="crit">atrasada</Pill> : <Pill tone={sla.tone === "warn" ? "warn" : "info"}>pendente</Pill>}</td>
                  <td className={s.sla}><Meter label={`Prazo de ${i.userId.slice(0, 8)}`} value={sla.used} max={sla.max} tone={sla.tone} valueText={`${num(sla.used)} de ${num(sla.max)} dias`} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}

      <h2 className={s.sec}>Histórico mensal</h2>
      {hist.length === 0 ? <EmptyState title="Sem histórico ainda" text="O histórico mensal começa com a primeira solicitação." /> : (
        <>
          <BarLineChart title="Solicitações por mês" data={hist.map((h) => ({ label: h.label, a: h.requested, b: h.processed, line: h.late }))} names={{ a: "Pedidos", b: "Concluídos", line: "Atrasadas" }} />
          <div className={s.tools} style={{ marginTop: 12 }}><CsvButton filename="lgpd-historico-mensal" rows={histCsv} cols={[{ key: "mes", label: "Mês" }, { key: "pedidos", label: "Pedidos" }, { key: "concluidos", label: "Concluídos" }, { key: "atrasadas", label: "Atrasadas" }]} label="Exportar histórico" /></div>
        </>
      )}
    </>
  );
}
