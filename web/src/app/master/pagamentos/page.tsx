import { MNote } from "@/revela/master-kit";
import { MasterStatePage } from "@/revela/master";
import { ExportSheetButton } from "../ExportSheetButton";
import { ReconcileSheetButton } from "../ReconcileSheetButton";
import { MasterPagamentosView, type PagamentoRow } from "@/revela/screens/MasterPagamentos";
import { brl, divergenceText } from "../billing";
import { requireRole, rpc } from "../data";
import { methodLabel, nf, relWhen } from "../format";
import { orderLabel } from "./status";

interface Order {
  orderId: string; createdAt: string; eventTitle: string | null; planCode: string; planName: string | null; amountCents: number; status: string;
  paymentMethod?: string | null; needsRefund: boolean; refundRequestedAt: string | null;
}
interface Divergence { kind: string; orderId: string; eventTitle: string | null; occurrences: number }
interface Summary { byStatus: Record<string, { count: number; amountCents: number }>; paid30d: { count: number; amountCents: number }; pendingOver1h: number }

const FILTROS = [["", "Todos"], ["pix", "Pix"], ["cartao", "Cartão"], ["pendentes", "Pendentes"], ["recusados", "Recusados"], ["estornos", "Estornos"]] as const;
const MATCH: Record<string, (o: Order) => boolean> = {
  pix: (o) => o.paymentMethod === "pix",
  cartao: (o) => o.paymentMethod === "card" || o.paymentMethod === "cartao",
  pendentes: (o) => o.status === "pendente",
  recusados: (o) => o.status === "falhou",
  estornos: (o) => o.status === "estornado" || o.needsRefund || o.refundRequestedAt != null,
};

export default async function Pagamentos({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const gate = await requireRole("pagamentos");
  if ("denied" in gate) return gate.denied;
  const { sb } = gate;
  const f = (await searchParams).f ?? "";
  const filtro = MATCH[f] ? f : "";
  const [s, list, div, lastReq] = await Promise.all([
    rpc<Summary>(sb, "admin_payments_summary"),
    rpc<Order[]>(sb, "admin_list_payments", { p_limit: 200 }),
    rpc<Divergence[]>(sb, "admin_payment_divergences"),
    rpc<{ items: { at: string }[] }>(sb, "admin_list_audit", { p_limit: 1, p_offset: 0, p_action: "payments.reconcile_requested" }),
  ]);
  if (list.state !== "ok") return <MasterStatePage area="Pagamentos" variant={list.state === "denied" ? "denied" : "error"} />;
  const all = list.data;
  const shown = filtro ? all.filter(MATCH[filtro]) : all;
  const rows: PagamentoRow[] = shown.map((o) => {
    const st = orderLabel(o);
    return { key: o.orderId, when: relWhen(o.createdAt), order: `#${o.orderId.slice(0, 8).toUpperCase()}`, event: o.eventTitle ?? "Evento excluído", plan: o.planName ?? o.planCode, method: methodLabel(o.paymentMethod), amount: brl(o.amountCents), tone: st.tone, status: st.label, href: `/master/pagamentos/${o.orderId}` };
  });
  if (all.length === 0 && !filtro) {
    return <MasterStatePage area="Pagamentos" variant="empty" caption="Cobranças da ValidaPay, conciliadas com os pedidos do Revela" title="Nenhum pagamento ainda" text="Quando alguém pagar um plano, o pedido aparece aqui." actions={<ReconcileSheetButton />} />;
  }
  const sum = s.state === "ok" ? s.data : null;
  const lastAt = lastReq.state === "ok" ? lastReq.data.items[0]?.at : undefined;
  const pend = sum?.byStatus.pendente;
  const toRefund = all.filter((o) => o.needsRefund).length;
  return (
    <MasterPagamentosView
      caption="Cobranças conciliadas com os pedidos do Revela. A conciliação com o provedor roda sozinha a cada poucos minutos."
      tiles={[
        { label: "Pago (30 dias)", value: brl(sum?.paid30d.amountCents ?? 0, { compact: true }), note: `${nf(sum?.paid30d.count ?? 0)} ${sum?.paid30d.count === 1 ? "pedido" : "pedidos"}` },
        { label: "Pendentes", value: brl(pend?.amountCents ?? 0, { compact: true }), note: `${nf(pend?.count ?? 0)} aguardando${sum?.pendingOver1h ? ` · ${sum.pendingOver1h} há mais de 1 h` : ""}` },
        { label: "Recusados", value: nf(sum?.byStatus.falhou?.count ?? 0), note: "não aprovados pelo banco" },
        { label: "Para estornar", value: nf(toRefund), note: toRefund ? "dinheiro recebido sem plano" : "nada a estornar" },
      ]}
      chips={FILTROS.map(([k, label]) => ({ label, href: k ? `/master/pagamentos?f=${k}` : "/master/pagamentos", on: k === filtro }))}
      rows={rows}
      actions={<>
        <ReconcileSheetButton last={lastAt ? relWhen(lastAt) : undefined} />
        <ExportSheetButton kind="pagamentos" screen="pagamentos" screenLabel="Pagamentos" filters={{ f: filtro }} period="Todo o período"
          filtersText={`Método e situação: ${FILTROS.find(([k]) => k === filtro)?.[1] ?? "Todos"}`} rowsEstimate={shown.length} />
      </>}
      alerts={div.state === "ok" && div.data.length > 0 ? (
        <div className="stack" style={{ marginBottom: "14px", gap: "8px" }} aria-label="Divergências">
          {div.data.map((d) => <MNote key={`${d.orderId}-${d.kind}`}><strong>{d.eventTitle ?? "Evento excluído"}:</strong> {divergenceText(d.kind)}{d.occurrences > 1 ? ` (${d.occurrences} vezes)` : ""}</MNote>)}
        </div>
      ) : undefined}
    />
  );
}
