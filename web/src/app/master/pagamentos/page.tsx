import { MNote, MState } from "@/revela/master-kit";
import { ExportButton } from "../ExportButton";
import { ReconcileButton } from "../ReconcileButton";
import { MasterPagamentosView, type PagamentoRow } from "@/revela/screens/MasterPagamentos";
import { brl, divergenceText } from "../billing";
import { requireMaster, rpc } from "../data";
import { methodLabel, nf, relWhen } from "../format";
import { orderLabel } from "./status";
import { MasterPager } from "../MasterPager";
import { pageNumber, PAGE_SIZE } from "../pagination";

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

export default async function Pagamentos({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; p?: string }> }) {
  const sb = await requireMaster();
  const sp=await searchParams,p=pageNumber(sp.p),q=sp.q?.trim().slice(0,80)||"";
  const f = sp.f ?? "";
  const filtro = MATCH[f] ? f : "";
  const [s, list, div] = await Promise.all([
    rpc<Summary>(sb, "admin_payments_summary"),
    rpc<{items:Order[];total:number;needsRefund:number}>(sb, "admin_master_list", { p_kind:"pagamentos",p_filter:filtro||null,p_search:q||null,p_offset:(p-1)*PAGE_SIZE }),
    rpc<Divergence[]>(sb, "admin_payment_divergences"),
  ]);
  if (list.state !== "ok") return <MState kind={list.state === "denied" ? "denied" : "error"} text={list.state === "error" ? `Não foi possível carregar: ${list.message}` : undefined} />;
  const rows: PagamentoRow[] = list.data.items.map((o) => {
    const st = orderLabel(o);
    return { key: o.orderId, when: relWhen(o.createdAt), order: `#${o.orderId.slice(0, 8).toUpperCase()}`, event: o.eventTitle ?? "Evento excluído", plan: o.planName ?? o.planCode, method: methodLabel(o.paymentMethod), amount: brl(o.amountCents), tone: st.tone, status: st.label, href: `/master/pagamentos/${o.orderId}` };
  });
  const sum = s.state === "ok" ? s.data : null;
  const pend = sum?.byStatus.pendente;
  const toRefund = list.data.needsRefund;
  return (
    <MasterPagamentosView
      tiles={[
        { label: "Pago (30 dias)", value: brl(sum?.paid30d.amountCents ?? 0, { compact: true }), note: `${nf(sum?.paid30d.count ?? 0)} ${sum?.paid30d.count === 1 ? "pedido" : "pedidos"}` },
        { label: "Pendentes", value: brl(pend?.amountCents ?? 0, { compact: true }), note: `${nf(pend?.count ?? 0)} aguardando${sum?.pendingOver1h ? ` · ${sum.pendingOver1h} há mais de 1 h` : ""}` },
        { label: "Recusados", value: nf(sum?.byStatus.falhou?.count ?? 0), note: "não aprovados pelo banco" },
        { label: "Para estornar", value: nf(toRefund), note: toRefund ? "dinheiro recebido sem plano" : "nada a estornar" },
      ]}
      chips={FILTROS.map(([k, label]) => ({ label, href: `/master/pagamentos${k||q?`?${new URLSearchParams({...k?{f:k}:{},...q?{q}:{}})}`:""}`, on: k === filtro }))}
      pager={<MasterPager total={list.data.total} page={p} path="/master/pagamentos" query={{f:filtro,q}}/>}
      rows={rows} actions={<><ReconcileButton /><ExportButton kind="pagamentos" screen="pagamentos" filters={{ f: filtro }} /></>}
      alerts={div.state === "ok" && div.data.length > 0 ? (
        <div className="stack" style={{ marginBottom: "14px", gap: "8px" }} aria-label="Divergências">
          {div.data.map((d) => <MNote key={`${d.orderId}-${d.kind}`}><strong>{d.eventTitle ?? "Evento excluído"}:</strong> {divergenceText(d.kind)}{d.occurrences > 1 ? ` (${d.occurrences} vezes)` : ""}</MNote>)}
        </div>
      ) : undefined}
    />
  );
}
