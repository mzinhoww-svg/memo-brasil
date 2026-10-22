import { num, requireMaster, rpc, when } from "../data";
import { Badge, Metric, StateBox, Table } from "../ui";
import { brl, chargeHint, divergenceText, envLabel, orderStatus } from "../billing";
import { CourtesyButton, RefundButton } from "../billing-actions";

interface Order {
  orderId: string; createdAt: string; eventId: string | null; eventTitle: string | null; planCode: string; planName: string | null;
  fromPlanCode: string | null; amountCents: number; status: string; provider: string; providerEnv: string; providerChargeId: string | null;
  needsRefund: boolean; refundRequestedAt: string | null;
}
interface Divergence { kind: string; orderId: string; eventTitle: string | null; status: string; detectedAt: string; occurrences: number }
interface Summary {
  env: string; byStatus: Record<string, { count: number; amountCents: number }>; paid30d: { count: number; amountCents: number };
  pendingOver1h: number; divergences: number;
}
interface EventsPage { items: { id: string; title: string; hostName: string | null }[] }
interface Plan { code: string; name: string; isFree: boolean }

export default async function Pagamentos() {
  const sb = await requireMaster();
  const [s, list, div, evs, plans] = await Promise.all([
    rpc<Summary>(sb, "admin_payments_summary"),
    rpc<Order[]>(sb, "admin_list_payments", { p_limit: 200 }),
    rpc<Divergence[]>(sb, "admin_payment_divergences"),
    rpc<EventsPage>(sb, "admin_list_events", { p_limit: 100, p_status: "ativo" }),
    rpc<Plan[]>(sb, "admin_list_plans"),
  ]);
  const env = s.state === "ok" ? s.data.env : "desligado";
  const count = (st: string) => (s.state === "ok" ? s.data.byStatus[st]?.count ?? 0 : 0);
  const events = evs.state === "ok" ? evs.data.items.map((e) => ({ id: e.id, label: `${e.title}${e.hostName ? ` · ${e.hostName}` : ""}` })) : [];
  const paidPlans = plans.state === "ok" ? plans.data.filter((p) => !p.isFree).map((p) => ({ code: p.code, name: p.name })) : [];

  return (
    <>
      <header className="adm-head">
        <div className="adm-head-title">
          <h1>Pagamentos</h1>
          <Badge s={env === "production" ? "ok" : env === "sandbox" ? "aviso" : "info"}>{envLabel(env)}</Badge>
        </div>
        <CourtesyButton events={events} plans={paidPlans} />
      </header>

      {s.state === "ok" ? (
        <div className="adm-grid">
          <Metric rotulo="Pagos (30 dias)" valor={brl(s.data.paid30d.amountCents, { compact: true })} nota={`${num(s.data.paid30d.count)} ${s.data.paid30d.count === 1 ? "pedido" : "pedidos"}`} />
          <Metric rotulo="Pendentes" valor={num(count("pendente"))} nota={`${num(s.data.pendingOver1h)} com mais de 1 h`} />
          <Metric rotulo="Expirados" valor={num(count("expirado"))} nota="nada cobrado" />
          <Metric rotulo="Divergências" valor={num(s.data.divergences)} nota={s.data.divergences ? "precisa de ação" : "nada a revisar"} />
        </div>
      ) : <StateBox load={s} />}

      {div.state === "ok" ? (
        div.data.length > 0 && (
          <ul className="adm-alerts" aria-label="Divergências">
            {div.data.map((d) => (
              <li key={`${d.orderId}-${d.kind}`} className="adm-alert">
                <strong>{d.eventTitle ?? "Evento excluído"}:</strong> {divergenceText(d.kind)}
                {d.occurrences > 1 ? ` (${d.occurrences} vezes)` : ""} <span className="adm-nota">{when(d.detectedAt)}</span>
              </li>
            ))}
          </ul>
        )
      ) : <StateBox load={div} />}

      {list.state === "ok" ? (
        <Table
          vazio="Nenhum pedido ainda."
          cols={[{ k: "d", h: "Data" }, { k: "e", h: "Evento" }, { k: "p", h: "Plano" }, { k: "v", h: "Valor", num: true }, { k: "s", h: "Status" },
                 { k: "c", h: "Cobrança" }, { k: "a", h: "Ações" }]}
          rows={list.data.map((o) => {
            const st = orderStatus(o);
            return {
              d: when(o.createdAt),
              e: o.eventTitle ?? <span className="adm-nota">Evento excluído</span>,
              p: o.planName ?? o.planCode,
              v: <>{brl(o.amountCents)}{o.fromPlanCode && o.fromPlanCode !== "gratis" ? <span className="adm-nota"> (dif.)</span> : null}</>,
              s: <>
                <Badge s={st.tone}>{st.label}</Badge>
                {o.needsRefund && <> <Badge s="erro">reembolsar</Badge></>}
                {o.providerEnv !== env && <> <span className="adm-nota">{o.providerEnv}</span></>}
              </>,
              c: <code title={`${o.provider} · ${o.providerChargeId ?? "sem cobrança"}`}>{chargeHint(o.providerChargeId)}</code>,
              a: o.status === "pago" && o.providerChargeId
                ? <RefundButton order={{ orderId: o.orderId, eventTitle: o.eventTitle, planName: o.planName, amountCents: o.amountCents, providerChargeId: o.providerChargeId, refundRequestedAt: o.refundRequestedAt }} />
                : null,
            };
          })}
        />
      ) : <StateBox load={list} />}
    </>
  );
}
