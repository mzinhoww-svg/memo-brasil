import { MasterStatePage } from "@/revela/master/MasterState";
import { FILTERS, STATUS_LABEL, PRODUCT_LABEL, REQUESTER_LABEL, isStatus, type PrintStatus } from "@/lib/master/print-orders";
import { IMPRESSOES_CAPTION, MasterImpressoesView, type ImpressaoRow } from "@/revela/screens/MasterImpressoes";
import { requirePrintedAlbum, rpc } from "../data";
import { nf, relWhen } from "../format";
import { PAGE_SIZE, pageNumber } from "../pagination";
import { PrintExport } from "./PrintExport";

interface Item {
  id: string; code: string; eventTitle: string; product: string; quantity: number; photoCount: number | null; allPhotos: boolean;
  contactName: string; requesterKind: string; status: PrintStatus; createdAt: string;
}
interface Board { total: number; counts: Record<string, number>; items: Item[] }

/** M29 · Impressões (só master, e só com a chave `printed_album`: sem ela, 404). Filtro por status com contagem, busca, paginação e Exportar. */
export default async function Impressoes({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; p?: string }> }) {
  const gate = await requirePrintedAlbum();
  if ("denied" in gate) return gate.denied;
  const sp = await searchParams;
  const filtro = isStatus(sp.f) ? sp.f : "";
  const q = sp.q?.trim().slice(0, 80) || "";
  const p = pageNumber(sp.p);
  const r = await rpc<Board>(gate.sb, "admin_print_orders", { p_filter: filtro || null, p_search: q || null, p_limit: PAGE_SIZE, p_offset: (p - 1) * PAGE_SIZE });
  if (r.state === "denied") return <MasterStatePage area="Impressões" variant="denied" />;
  if (r.state === "error") return <MasterStatePage area="Impressões" variant="error" />;
  const { total, counts: c, items } = r.data;
  const exporter = (rows: number) => <PrintExport status={filtro} q={q} rowsEstimate={rows} filtersText={`Situação: ${filtro ? STATUS_LABEL[filtro] : "todas"}${q ? ` · Busca: ${q}` : ""}`} />;
  if (!(c.todos ?? 0) && !q) {
    return <MasterStatePage area="Impressões" variant="empty" caption={IMPRESSOES_CAPTION} actions={exporter(0)} title="Nenhum pedido de impressão" text="Os pedidos feitos pelos anfitriões e convidados aparecem aqui." />;
  }
  const href = (o: { f?: string; p?: number }) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    const f = o.f ?? filtro;
    if (f) u.set("f", f);
    if (o.p && o.p > 1) u.set("p", String(o.p));
    return `/master/impressoes${u.size ? `?${u}` : ""}`;
  };
  const rows: ImpressaoRow[] = items.map((o) => ({
    id: o.id, code: o.code, event: o.eventTitle || "Evento excluído", who: `${o.contactName} · ${REQUESTER_LABEL[o.requesterKind] ?? o.requesterKind}`,
    product: PRODUCT_LABEL[o.product] ?? o.product, qty: o.quantity, photos: o.allPhotos ? "todas" : String(o.photoCount ?? 0), status: o.status,
    created: relWhen(o.createdAt), href: `/master/impressoes/${o.id}`,
  }));
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? (p - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, (p - 1) * PAGE_SIZE + items.length);
  return (
    <MasterImpressoesView
      exportButton={exporter(total)}
      chips={FILTERS.map((f) => ({ label: `${f.label} ${nf(f.key ? c[f.key] ?? 0 : c.todos ?? 0)}`, on: f.key === filtro, href: href({ f: f.key, p: 1 }) }))}
      search={{ value: q, action: "/master/impressoes", hidden: filtro ? { f: filtro } : {} }}
      rows={rows} emptyFilter={!rows.length}
      rangeText={`${from}–${to} de ${nf(total)} · ${PAGE_SIZE} por página`}
      pager={{ page: Math.min(p, last), prev: p > 1 ? href({ p: p - 1 }) : undefined, next: p < last ? href({ p: p + 1 }) : undefined }}
      inFlow
    />
  );
}
