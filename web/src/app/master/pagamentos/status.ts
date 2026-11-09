import type { Tone } from "@/revela/master-kit";

/** Situação do pedido como o desenho mostra (Pago, Pendente, Recusado, Estornar, Estornado…). Só `needsRefund` vira "Estornar". */
export function orderLabel(o: { status: string; needsRefund: boolean; refundRequestedAt: string | null }): { label: string; tone: Tone } {
  if (o.refundRequestedAt && o.status !== "estornado") return { label: "Estorno em andamento", tone: "wait" };
  if (o.needsRefund && o.status !== "estornado") return { label: "Estornar", tone: "bad" };
  switch (o.status) {
    case "pago": return { label: "Pago", tone: "ok" };
    case "pendente": return { label: "Pendente", tone: "wait" };
    case "criado": return { label: "Criado", tone: "info" };
    case "falhou": return { label: "Recusado", tone: "bad" };
    case "estornado": return { label: "Estornado", tone: "info" };
    case "expirado": return { label: "Expirado", tone: "info" };
    case "cancelado": return { label: "Cancelado", tone: "info" };
    case "em_disputa": return { label: "Em disputa", tone: "bad" };
    case "perdido": return { label: "Perdido", tone: "bad" };
    default: return { label: o.status, tone: "info" };
  }
}
