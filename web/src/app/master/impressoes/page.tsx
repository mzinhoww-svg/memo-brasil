import { Chips, MHead, MState, MTable, St, Tiles, type MRow } from "@/revela/master-kit";
import { ExportButton } from "../ExportButton";
import { requireMaster, rpc } from "../data";
import { nf, relWhen } from "../format";
import { PrintOrderActions } from "./PrintOrderActions";
import { FILTERS, isStatus, STATUS_LABEL, STATUS_TONE, type PrintStatus } from "./status";

interface Item {
  id: string; eventTitle: string; product: "album" | "caixa"; quantity: number; photoCount: number | null; allPhotos: boolean;
  contactName: string; contactPhone: string | null; contactEmail: string | null; requesterKind: "anfitriao" | "convidado";
  shipping: { street?: string; number?: string; neighborhood?: string; city?: string; state?: string; cep?: string };
  note: string | null; noteInternal: string | null; status: PrintStatus; createdAt: string;
}
interface Board { total: number; counts: Record<string, number>; items: Item[] }
const POR = 25;
const PRODUCT = { album: "Álbum", caixa: "Caixa 30 fotos" } as const;

/** Pedidos de impressão (sem cobrança): o Master acompanha, muda o status e anota. Só o Master vê contato e endereço. */
export default async function Impressoes({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; p?: string }> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const filtro = isStatus(sp.f) ? sp.f : "";
  const q = sp.q?.slice(0, 80) || "";
  const p = Math.max(1, Number(sp.p) || 1);
  const r = await rpc<Board>(sb, "admin_print_orders", { p_filter: filtro || null, p_search: q || null, p_limit: POR, p_offset: (p - 1) * POR });
  if (r.state !== "ok") return <MState kind={r.state === "denied" ? "denied" : "error"} text={r.state === "error" ? `Não foi possível carregar: ${r.message}` : undefined} />;
  const c = r.data.counts;
  const href = (o: { f?: string; p?: number; noQ?: boolean }) => {
    const u = new URLSearchParams();
    if (q && !o.noQ) u.set("q", q);
    const f = o.f ?? filtro;
    if (f) u.set("f", f);
    if (o.p && o.p > 1) u.set("p", String(o.p));
    return `/master/impressoes${u.size ? `?${u}` : ""}`;
  };
  const rows: MRow[] = r.data.items.map((o) => ({
    key: o.id,
    cells: [
      relWhen(o.createdAt),
      `${o.eventTitle || "Evento excluído"} · ${o.requesterKind === "convidado" ? "convidado" : "anfitrião"}`,
      `${PRODUCT[o.product]} × ${o.quantity} · ${o.allPhotos ? "todas as fotos" : `${o.photoCount ?? 0} fotos`}`,
      <span key="c">{o.contactName}<br /><small>{o.contactPhone ?? o.contactEmail}</small></span>,
      `${o.shipping.street ?? ""}, ${o.shipping.number ?? ""} · ${o.shipping.city ?? ""}/${o.shipping.state ?? ""}`,
      <St key="s" tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</St>,
      <span key="a" className="row" style={{ gap: "6px" }}><PrintOrderActions id={o.id} status={o.status} note={o.noteInternal} /></span>,
    ],
  }));
  const last = Math.max(1, Math.ceil(r.data.total / POR));
  return (
    <>
      <MHead title="Impressões" caption={`Pedidos de álbum e fotos impressas, sem cobrança por enquanto${q ? ` · busca "${q}"` : ""}`}>
        <ExportButton kind="impressoes" screen="impressoes" filters={{ status: filtro, q }} />
      </MHead>
      <Tiles items={[
        { label: "Solicitados", value: nf(c.solicitado ?? 0), note: "aguardando contato" },
        { label: "Em produção", value: nf(c.em_producao ?? 0), note: "na gráfica" },
        { label: "Enviados", value: nf(c.enviado ?? 0), note: "a caminho" },
        { label: "Entregues", value: nf(c.entregue ?? 0), note: `${nf(c.cancelado ?? 0)} cancelados` },
      ]} />
      <form method="get" role="search" className="row" style={{ gap: "8px", marginBottom: "14px" }}>
        {filtro && <input type="hidden" name="f" value={filtro} />}
        <label className="rv-field" style={{ maxWidth: "340px" }}>
          <input name="q" defaultValue={q} placeholder="Nome, contato ou evento" aria-label="Buscar pedido" maxLength={80} />
        </label>
        <button className="rv-btn rv-btn--sm" type="submit">Buscar</button>
        {q && <a className="rv-btn rv-btn--sm" href={href({ p: 1, noQ: true })}>Limpar</a>}
      </form>
      <Chips items={FILTERS.map(([k, label]) => ({ label: `${label}${k ? ` ${nf(c[k] ?? 0)}` : ` ${nf(c.todos ?? 0)}`}`, href: href({ f: k, p: 1 }), on: k === filtro }))} />
      <MTable cols="0.8fr 1.5fr 1.5fr 1.3fr 1.6fr 0.9fr 1.4fr" head={["Quando", "Evento", "Pedido", "Contato", "Entrega", "Situação", ""]} rows={rows} empty="Nenhum pedido neste filtro." />
      {last > 1 && (
        <nav aria-label="Paginação" className="row" style={{ gap: "12px", marginTop: "16px", alignItems: "center" }}>
          {p > 1 && <a className="link" href={href({ p: p - 1 })}>← Anterior</a>}
          <span className="rv-caption">Página {p} de {last} · {nf(r.data.total)} pedidos</span>
          {p < last && <a className="link" href={href({ p: p + 1 })}>Próxima →</a>}
        </nav>
      )}
    </>
  );
}
