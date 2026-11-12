import { MasterStatePage } from "@/revela/master/MasterState";
import { PRODUCT_LABEL, REQUESTER_LABEL, buildTimeline, formatAddress, formatPhone, type HistoryItem, type PrintStatus, type Shipping } from "@/lib/master/print-orders";
import type { ImpressaoDetalheData } from "@/revela/screens/MasterImpressaoDetalhe";
import { DetalheActions } from "@/revela/screens/MasterImpressaoDetalhe";
import { requirePrintedAlbum, rpc } from "../../data";
import { relWhen } from "../../format";
import { PrintOrderDetail } from "./PrintOrderDetail";

interface Detail {
  id: string; code: string; status: PrintStatus; product: string; quantity: number; eventTitle: string; requesterKind: string;
  contactName: string; contactPhone: string | null; contactEmail: string | null; shipping: Shipping; note: string | null;
  photoCount: number; photoNums: number[]; history: HistoryItem[]; noteInternal: string | null; createdAt: string;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** M30 · Detalhe do pedido de impressão (só master, e só com a chave `printed_album`). Contato, endereço e nota interna só o master vê; fotos só como números. */
export default async function ImpressaoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePrintedAlbum();
  if ("denied" in gate) return gate.denied;
  const { id } = await params;
  const back = <DetalheActions back={{ href: "/master/impressoes" }} onCancel={null} advance={null} />;
  const none = <MasterStatePage area="Impressões" variant="empty" actions={back} title="Pedido não encontrado" text="Volte para a lista de pedidos." />;
  if (!UUID.test(id)) return none;
  const r = await rpc<Detail | null>(gate.sb, "admin_print_order_detail", { p_id: id });
  if (r.state === "denied") return <MasterStatePage area="Impressões" variant="denied" />;
  if (r.state === "error") return <MasterStatePage area="Impressões" variant="error" />;
  const d = r.data;
  if (!d) return none;
  const n = d.quantity;
  const data: ImpressaoDetalheData = {
    code: d.code,
    caption: `${PRODUCT_LABEL[d.product] ?? d.product} · ${n} ${n === 1 ? "unidade" : "unidades"} · ${d.eventTitle || "Evento excluído"} · criado ${relWhen(d.createdAt)}`,
    status: d.status,
    contact: {
      name: `${d.contactName} · ${REQUESTER_LABEL[d.requesterKind] ?? d.requesterKind}`, phone: d.contactPhone ? formatPhone(d.contactPhone) : "—", email: d.contactEmail ?? "—",
      address: formatAddress(d.shipping), note: d.note?.trim() || "—",
    },
    photos: { count: d.photoCount, nums: d.photoNums },
    timeline: buildTimeline(d.history, (iso) => relWhen(iso)),
    noteInternal: d.noteInternal ?? "",
  };
  return <PrintOrderDetail id={d.id} data={data} />;
}
