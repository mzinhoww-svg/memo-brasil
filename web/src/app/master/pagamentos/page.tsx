import Link from "next/link";
import { num, requireMaster, rpc, when, type SearchParams } from "../data";
import { Badge, Metric, StateBox, Table } from "../ui";
import { brl, canRefund, divergenceText, envLabel, orderStatus, paymentRef, providerLabel } from "../billing";
import { CourtesyButton, RefundButton } from "../billing-actions";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Funnel } from "../kit/Funnel";
import { Pill } from "../kit/Pill";
import { StackBar } from "../kit/StackBar";
import { SortableTable } from "../kit/SortableTable";
import { hrefWith, parseSort, sortRows } from "../kit/url";
import { envInfo, funnelFromStatus, isStalePending, matchOrders, revenueByPlan } from "./lib";
import { pct } from "@/features/master/format";
import css from "./page.module.css";

interface Order {
  orderId: string; createdAt: string; eventId: string | null; eventTitle: string | null; planCode: string; planName: string | null;
  fromPlanCode: string | null; amountCents: number; status: string; provider: string; providerEnv: string; providerChargeId: string | null; providerPaymentId?: string | null; paymentMethod?: string | null;
  needsRefund: boolean; refundRequestedAt: string | null;
}
interface Divergence { kind: string; orderId: string; eventTitle: string | null; status: string; detectedAt: string; occurrences: number; refundInProgress: boolean }
interface Summary {
  env: string; byStatus: Record<string, { count: number; amountCents: number }>; paid30d: { count: number; amountCents: number };
  pendingOver1h: number; divergences: number;
}
interface EventsPage { items: { id: string; title: string; hostName: string | null }[] }
interface Plan { code: string; name: string; isFree: boolean }

const PATH = "/master/pagamentos";
const nowMs = () => Date.now();
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Pagamentos({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").trim().slice(0, 80);
  const [s, list, div, evs, plans] = await Promise.all([
    rpc<Summary>(sb, "admin_payments_summary"),
    rpc<Order[]>(sb, "admin_list_payments", { p_limit: 500 }),
    rpc<Divergence[]>(sb, "admin_payment_divergences"),
    rpc<EventsPage>(sb, "admin_list_events", { p_limit: 100, p_status: "ativo" }),
    rpc<Plan[]>(sb, "admin_list_plans"),
  ]);
  const env = s.state === "ok" ? s.data.env : "desligado";
  const info = envInfo(env);
  const events = evs.state === "ok" ? evs.data.items.map((e) => ({ id: e.id, label: `${e.title}${e.hostName ? ` · ${e.hostName}` : ""}` })) : [];
  const paidPlans = plans.state === "ok" ? plans.data.filter((p) => !p.isFree).map((p) => ({ code: p.code, name: p.name })) : [];
  const now = nowMs();
  const orders = list.state === "ok" ? list.data : [];
  const shown = matchOrders(orders, q);
  const { ord, dir } = parseSort(sp, ["createdAt", "amountCents", "status", "planLabel", "eventLabel"], { ord: "createdAt", dir: "desc" });
  const rows = sortRows(shown.map((o) => ({ ...o, planLabel: o.planName ?? o.planCode, eventLabel: o.eventTitle ?? "" })), ord, dir);
  const byPlan = revenueByPlan(orders);
  const totalRevenue = byPlan.reduce((t, p) => t + p.revenueCents, 0);
  const funnel = s.state === "ok" ? funnelFromStatus(s.data.byStatus) : null;
  const divCount = div.state === "ok" ? div.data.length : 0;
  const stale = orders.filter((o) => isStalePending(o, now));
  const count = (st: string) => (s.state === "ok" ? s.data.byStatus[st]?.count ?? 0 : 0);

  return (
    <>
      <header className="adm-head">
        <div>
          <div className="adm-head-title">
            <h1>Pagamentos</h1>
            <Badge s={env === "production" ? "ok" : env === "sandbox" ? "aviso" : "info"}>{envLabel(env)}</Badge>
          </div>
          <p>Provedor ativo: Mercado Pago (Checkout Pro). Pedidos da AbacatePay são históricos e seguem válidos.</p>
        </div>
        <CourtesyButton events={events} plans={paidPlans} />
      </header>

      <section className={css.env} aria-label="Ambiente de pagamento">
        <Pill tone={info.tone}>{info.title}</Pill>
        <p>{info.text}</p>
      </section>

      {div.state === "ok" ? (
        divCount > 0 && (
          <section className={css.divs} aria-labelledby="pg-div">
            <h2 id="pg-div">Divergências ({num(divCount)})</h2>
            <ul className="adm-alerts" style={{ margin: 0 }} aria-label="Divergências">
              {div.data.map((d) => (
                <li key={`${d.orderId}-${d.kind}`} className="adm-alert" data-andamento={d.refundInProgress || undefined}>
                  <strong>{d.eventTitle ?? "Evento excluído"}:</strong> {divergenceText(d.kind)}
                  {d.occurrences > 1 ? ` (${d.occurrences} vezes)` : ""} {d.refundInProgress && <Badge s="aviso">reembolso em andamento</Badge>}{" "}
                  <span className="adm-nota">{when(d.detectedAt)}</span>{" "}
                  <Link href={hrefWith(PATH, sp, { q: d.orderId })}>Ver pedido</Link>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 8 }}>
              <CsvButton filename="divergencias-pagamentos" rows={div.data} cols={[
                { key: "orderId", label: "Pedido" }, { key: "kind", label: "Tipo" }, { key: "eventTitle", label: "Evento" },
                { key: "status", label: "Status" }, { key: "detectedAt", label: "Detectada em" }, { key: "occurrences", label: "Ocorrências" },
                { key: "refundInProgress", label: "Reembolso em andamento" },
              ]} />
            </div>
          </section>
        )
      ) : <StateBox load={div} />}

      {s.state === "ok" ? (
        <div className="adm-grid">
          <Metric rotulo="Pagos (30 dias)" valor={brl(s.data.paid30d.amountCents, { compact: true })} nota={`${num(s.data.paid30d.count)} ${s.data.paid30d.count === 1 ? "pedido" : "pedidos"}`} />
          <Metric rotulo="Pendentes" valor={num(count("pendente"))} nota={`${num(s.data.pendingOver1h)} com mais de 1 h`} />
          <Metric rotulo="Expirados" valor={num(count("expirado"))} nota="nada cobrado" />
          <Metric rotulo="Divergências" valor={num(s.data.divergences)} nota={s.data.divergences ? "precisa de ação" : "nada a revisar"} />
        </div>
      ) : <StateBox load={s} />}

      {s.state === "ok" && s.data.pendingOver1h > 0 && (
        <p className="adm-alert" role="status" style={{ marginTop: 16 }} data-andamento>
          <Pill tone="warn">{num(s.data.pendingOver1h)} pendente{s.data.pendingOver1h === 1 ? "" : "s"} há mais de 1 h</Pill>{" "}
          O cliente abriu o checkout e não concluiu, ou o provedor ainda não avisou. Confira o pagamento no painel do provedor antes de agir.
        </p>
      )}

      {funnel && (
        <div className={`${css.section} ${css.two}`}>
          <section className={css.col} aria-labelledby="pg-funil">
            <h2 id="pg-funil">Funil de pedidos</h2>
            <p className={css.rate}>{funnel.paidRate == null ? "Sem pedidos ainda." : `${pct(funnel.paid, funnel.created)} dos pedidos criados chegaram a ser pagos.`}</p>
            {funnel.created === 0 ? (
              <EmptyState title="Nenhum pedido criado" text="O funil aparece quando o primeiro cliente abrir o checkout." />
            ) : (
              <>
                <Funnel steps={[{ label: "Criados", value: funnel.created }, { label: "Pagos", value: funnel.paid }]} />
                <div style={{ marginTop: 16 }}>
                  <StackBar label="Situação dos pedidos criados" segments={[
                    { label: "Pagos", value: funnel.paid, color: "var(--ok)" },
                    { label: "Em aberto", value: funnel.pending, color: "var(--warn)" },
                    { label: "Expirados", value: funnel.expired, color: "var(--adm-s3)" },
                    { label: "Outros", value: funnel.other, color: "var(--adm-s4)" },
                  ]} />
                </div>
              </>
            )}
          </section>
          <section className={css.col} aria-labelledby="pg-receita">
            <h2 id="pg-receita">Receita por plano</h2>
            <p className={css.rate}>Pedidos pagos entre os últimos {num(orders.length)} listados.</p>
            {byPlan.length === 0 ? (
              <EmptyState title="Nenhuma venda paga" text="Pedidos pagos aparecem aqui, agrupados por plano." />
            ) : (
              <>
                <Table vazio="" cols={[{ k: "p", h: "Plano" }, { k: "v", h: "Vendas", num: true }, { k: "r", h: "Receita", num: true }, { k: "s", h: "Parte" }]}
                  rows={byPlan.map((p) => ({
                    p: p.name, v: num(p.sales), r: brl(p.revenueCents),
                    s: <span className={css.bar} role="img" aria-label={pct(p.revenueCents, totalRevenue)}><span style={{ width: `${totalRevenue ? (p.revenueCents / totalRevenue) * 100 : 0}%` }} /></span>,
                  }))} />
                <div style={{ marginTop: 8 }}>
                  <CsvButton filename="receita-por-plano" rows={byPlan.map((p) => ({ ...p, revenue: p.revenueCents / 100 }))} cols={[
                    { key: "name", label: "Plano" }, { key: "code", label: "Código" }, { key: "sales", label: "Vendas" }, { key: "revenue", label: "Receita (R$)" },
                  ]} />
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <div className={css.toolbar}>
        <h2>Pedidos{q ? ` (${num(shown.length)} encontrados)` : ""}</h2>
        {stale.length > 0 && <Pill tone="warn">{num(stale.length)} pendente{stale.length === 1 ? "" : "s"} há mais de 1 h</Pill>}
        <CsvButton filename="pedidos" rows={rows.map((o) => ({
          pedido: o.orderId, data: o.createdAt, evento: o.eventTitle ?? "Evento excluído", plano: o.planLabel, valor: o.amountCents / 100, status: o.status,
          provedor: providerLabel(o.provider), ambiente: o.providerEnv, pagamento: paymentRef(o), reembolsar: o.needsRefund ? "sim" : "não",
        }))} cols={[
          { key: "pedido", label: "Pedido" }, { key: "data", label: "Data" }, { key: "evento", label: "Evento" }, { key: "plano", label: "Plano" },
          { key: "valor", label: "Valor (R$)" }, { key: "status", label: "Status" }, { key: "provedor", label: "Provedor" },
          { key: "ambiente", label: "Ambiente" }, { key: "pagamento", label: "Pagamento" }, { key: "reembolsar", label: "Reembolsar" },
        ]} />
      </div>
      <form className={css.search} method="get" role="search" action={PATH}>
        <label className="adm-sr" htmlFor="pg-q">Buscar pedido</label>
        <input id="pg-q" name="q" defaultValue={q} placeholder="ID do pedido, do pagamento ou nome do evento" maxLength={80} />
        <button type="submit" className="adm-btn">Buscar</button>
        {q && <Link className="adm-btn" href={hrefWith(PATH, sp, { q: null })}>Limpar</Link>}
      </form>

      {list.state === "ok" ? (
        <SortableTable
          caption="Pedidos"
          path={PATH}
          params={sp}
          ord={ord}
          dir={dir}
          rowKey={(o) => o.orderId}
          rows={rows}
          empty={q
            ? { title: "Nenhum pedido encontrado", text: `Nada corresponde a "${q}" nos últimos ${num(orders.length)} pedidos.`, action: { href: hrefWith(PATH, sp, { q: null }), label: "Limpar busca" } }
            : { title: "Nenhum pedido ainda", text: "Os pedidos aparecem quando alguém abre o checkout de um plano." }}
          cols={[
            { key: "createdAt", label: "Data", render: (o) => when(o.createdAt) },
            { key: "eventLabel", label: "Evento", render: (o) => o.eventTitle ?? <span className="adm-nota">Evento excluído</span> },
            { key: "planLabel", label: "Plano" },
            { key: "amountCents", label: "Valor", num: true, render: (o) => <>{brl(o.amountCents)}{o.fromPlanCode && o.fromPlanCode !== "gratis" ? <span className="adm-nota"> (dif.)</span> : null}</> },
            { key: "status", label: "Status", render: (o) => {
              const st = orderStatus(o);
              return <>
                <Badge s={st.tone}>{st.label}</Badge>
                {isStalePending(o, now) && <> <Pill tone="warn">há mais de 1 h</Pill></>}
                {o.needsRefund && <> <Badge s="erro">reembolsar</Badge></>}
                {q && <> <span className={css.hit}>{o.orderId}</span></>}
              </>;
            } },
            { key: "provider", label: "Provedor", sortable: false, render: (o) => <>{providerLabel(o.provider)}<span className="adm-nota"> · {o.providerEnv}{o.providerEnv !== env ? " (diferente do atual)" : ""}</span></> },
            { key: "payment", label: "Pagamento", sortable: false, render: (o) => <code title={`${providerLabel(o.provider)} · ${paymentRef(o) === "—" ? "sem pagamento" : paymentRef(o)}${o.paymentMethod ? ` · ${o.paymentMethod}` : ""}`}>{paymentRef(o)}</code> },
            { key: "actions", label: "Ações", sortable: false, render: (o) => canRefund(o)
              ? <RefundButton order={{ orderId: o.orderId, eventTitle: o.eventTitle, planName: o.planName, amountCents: o.amountCents, providerChargeId: o.providerChargeId, providerPaymentId: o.providerPaymentId, provider: o.provider, refundRequestedAt: o.refundRequestedAt }} />
              : null },
          ]}
        />
      ) : <StateBox load={list} />}
    </>
  );
}
