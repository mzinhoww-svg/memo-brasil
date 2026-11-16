import { notFound } from "next/navigation";
import { BtnLink, MState } from "@/revela/master-kit";
import { MasterPagamentoDetalheView, type TimelineItem } from "@/revela/screens/MasterPagamentoDetalhe";
import { brl, canRefund, chargeHint, divergenceText, envLabel, providerLabel } from "../../billing";
import { RefundButton } from "../../billing-actions";
import { requireRole, rpc } from "../../data";
import { methodLabel, relWhen } from "../../format";

interface Order {
  orderId: string; createdAt: string; eventTitle: string | null; planCode: string; planName: string | null; fromPlanCode: string | null; amountCents: number; status: string;
  provider: string; providerEnv: string; providerChargeId: string | null; paymentMethod?: string | null; needsRefund: boolean; refundRequestedAt: string | null;
  refundReason: string | null; paidAt: string | null; expiresAt: string | null; refundedCents: number | null;
}
interface Divergence { kind: string; orderId: string }

/** M06: ficha do pedido, linha do tempo montada com o que o servidor registra no pedido e o estorno. */
export default async function PagamentoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const gate = await requireRole("pagamentos");
  if ("denied" in gate) return gate.denied;
  const { sb } = gate;
  const [list, div] = await Promise.all([rpc<Order[]>(sb, "admin_list_payments", { p_limit: 500 }), rpc<Divergence[]>(sb, "admin_payment_divergences")]);
  if (list.state !== "ok") return <MState kind={list.state === "denied" ? "denied" : "error"} />;
  const o = list.data.find((x) => x.orderId === id);
  if (!o) notFound();
  const method = methodLabel(o.paymentMethod);
  const minutes = o.expiresAt ? Math.max(1, Math.round((Date.parse(o.expiresAt) - Date.parse(o.createdAt)) / 60_000)) : null;
  const timeline: TimelineItem[] = [
    { key: "criado", tone: "ok", title: "Pedido criado", meta: `${relWhen(o.createdAt)} · ${brl(o.amountCents)} cotado no banco` },
    ...(o.providerChargeId ? [{ key: "cobranca", tone: "ok" as const, title: `Cobrança ${method} criada na ${providerLabel(o.provider)}`, meta: `${relWhen(o.createdAt)} · ${chargeHint(o.providerChargeId)}${minutes && method === "Pix" ? ` · expira em ${minutes} min` : ""}` }] : []),
    ...(o.paidAt ? [{ key: "pago", tone: "ok" as const, title: "Pagamento confirmado pelo provedor", meta: `${relWhen(o.paidAt)} · ${brl(o.amountCents)}` }, { key: "plano", tone: "ok" as const, title: `Plano ${o.planName ?? o.planCode} liberado`, meta: relWhen(o.paidAt) }] : []),
    ...(o.status === "falhou" ? [{ key: "falhou", tone: "bad" as const, title: "Pagamento não aprovado", meta: relWhen(o.createdAt) }] : []),
    ...(o.status === "expirado" ? [{ key: "exp", tone: "bad" as const, title: "Cobrança expirada sem pagamento", meta: relWhen(o.expiresAt) }] : []),
    ...(o.needsRefund ? [{ key: "reembolsar", tone: "bad" as const, title: "Dinheiro recebido sem plano: precisa de reembolso", meta: relWhen(o.paidAt ?? o.createdAt) }] : []),
    ...(o.refundRequestedAt ? [{ key: "reembolso", tone: "ok" as const, title: "Reembolso solicitado", meta: `${relWhen(o.refundRequestedAt)}${o.refundReason ? ` · ${o.refundReason}` : ""}` }] : []),
    ...(o.status === "estornado" ? [{ key: "estornado", tone: "ok" as const, title: "Estornado pelo provedor", meta: o.refundedCents ? brl(o.refundedCents) : "integral" }] : []),
  ];
  const kind = div.state === "ok" ? div.data.find((d) => d.orderId === o.orderId)?.kind : undefined;
  const note = kind ? divergenceText(kind) : o.needsRefund ? "Dinheiro recebido sem plano liberado. Precisa de reembolso." : null;
  return (
    <MasterPagamentoDetalheView
      title={`Pedido #${o.orderId.slice(0, 8).toUpperCase()}`}
      caption={`${o.eventTitle ?? "Evento excluído"} · ${o.planName ?? o.planCode}`}
      timeline={timeline}
      data={[
        { label: "Valor", value: `${brl(o.amountCents)} · pagamento único${o.fromPlanCode && o.fromPlanCode !== "gratis" ? " (diferença do plano anterior)" : ""}` },
        { label: "Método", value: method }, { label: "Ambiente", value: envLabel(o.providerEnv).charAt(0) + envLabel(o.providerEnv).slice(1).toLowerCase() },
        { label: `Cobrança ${providerLabel(o.provider)}`, value: o.providerChargeId ?? "—" },
      ]}
      note={note} backHref="/master/pagamentos"
      actions={<>
        {canRefund({ ...o, providerPaymentId: null }) && <RefundButton order={{ orderId: o.orderId, eventTitle: o.eventTitle, planName: o.planName, amountCents: o.amountCents, providerChargeId: o.providerChargeId, provider: o.provider, refundRequestedAt: o.refundRequestedAt }} />}
        <BtnLink href={`/master/pagamentos/${o.orderId}`} icon="search">Consultar</BtnLink>
      </>}
    />
  );
}
