/** Formatação e validação puras das telas de pagamentos (M1) e planos (M2) do console master. */

export const REASON_MIN = 10;
export const REASON_MAX = 500;

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const cents2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Centavos → "R$ 189,00". Zero vira "R$ 0"; `compact` arredonda para reais inteiros ("R$ 1.932"). */
export function brl(cents: number | null | undefined, opts: { compact?: boolean } = {}): string {
  const v = Number(cents ?? 0);
  if (v === 0) return "R$ 0";
  if (opts.compact) return `R$ ${int.format(Math.floor(v / 100))}`;
  return `R$ ${cents2.format(v / 100)}`;
}

/** Reais inteiros sem centavos; com centavos, duas casas ("R$ 189" · "R$ 349,90"). */
function brlShort(cents: number): string {
  return cents % 100 === 0 ? `R$ ${int.format(cents / 100)}` : brl(cents);
}

/** Preço digitado em reais ("199,00", "R$ 1.234,5", "29.90") → centavos; inválido → null. */
export function parseBrl(text: string): number | null {
  let s = text.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [r, c = ""] = s.split(".");
  return Number(r) * 100 + Number(c.padEnd(2, "0"));
}

/** Mensagem de erro do motivo (o servidor confere de novo, MM011) ou null quando válido. */
export function reasonError(reason: string): string | null {
  const n = reason.trim().length;
  if (n < REASON_MIN) return `Escreva o motivo com pelo menos ${REASON_MIN} caracteres.`;
  if (n > REASON_MAX) return `O motivo pode ter no máximo ${REASON_MAX} caracteres.`;
  return null;
}

export type PaymentsEnv = "desligado" | "sandbox" | "production";
export function envLabel(env: string): string {
  return env === "production" ? "PRODUÇÃO" : env === "sandbox" ? "SANDBOX" : "DESLIGADO";
}

type Tone = "ok" | "aviso" | "erro" | "info";
const STATUS: Record<string, { label: string; tone: Tone }> = {
  criado: { label: "criado", tone: "info" },
  pendente: { label: "pendente", tone: "aviso" },
  pago: { label: "pago", tone: "ok" },
  expirado: { label: "expirado", tone: "info" },
  cancelado: { label: "cancelado", tone: "info" },
  falhou: { label: "falhou", tone: "erro" },
  estornado: { label: "estornado", tone: "info" },
  em_disputa: { label: "em disputa", tone: "erro" },
  perdido: { label: "perdido", tone: "erro" },
};
export function orderStatus(o: { status: string; refundRequestedAt: string | null }): { label: string; tone: Tone } {
  if (o.refundRequestedAt && (o.status === "pago" || o.status === "cancelado")) return { label: "reembolso em andamento", tone: "aviso" };
  return STATUS[o.status] ?? { label: o.status, tone: "info" };
}

/** Reembolso pelo console: 'pago', ou 'cancelado' com needs_refund (Pix pago depois do cancelamento, Ruling 16). */
export function canRefund(o: { status: string; needsRefund: boolean; providerChargeId: string | null }): boolean {
  return !!o.providerChargeId && (o.status === "pago" || (o.status === "cancelado" && o.needsRefund));
}

/** Data (ISO) da alteração de preço/ativação mais recente entre todos os planos, ou null sem histórico. */
export function lastChange(plans: { history: { at: string }[] }[]): string | null {
  const all = plans.flatMap((p) => p.history.map((h) => h.at));
  return all.length ? all.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null;
}

/** "pix_char_…9c1": prefixo e os 3 últimos caracteres. */
export function chargeHint(id: string | null | undefined): string {
  if (!id) return "—";
  const cut = id.lastIndexOf("_");
  const prefix = cut > 0 ? id.slice(0, cut + 1) : "";
  return id.length <= prefix.length + 3 ? id : `${prefix}…${id.slice(-3)}`;
}

const DIVERGENCE: Record<string, string> = {
  pago_sem_direito: "pago sem plano liberado no evento.",
  direito_sem_pedido_pago: "plano pago liberado sem pedido pago.",
  pendente_1h: "Pix pendente há mais de 1 h.",
  needs_refund: "Dinheiro recebido sem plano liberado. Precisa de reembolso.",
  em_disputa: "pagamento em disputa no provedor.",
  pago_ignorado_reembolsar: "pagamento chegou para um pedido já encerrado. Precisa de reembolso.",
  upgrade_base_estornado: "o plano base deste upgrade foi estornado.",
  divergencia_valor: "valor informado pelo provedor diferente do pedido.",
  divergencia_ambiente: "o provedor informou outro ambiente (sandbox/produção).",
  divergencia_cobranca: "a cobrança informada não é a deste pedido.",
  transicao_ignorada: "o provedor informou pago num estado que não aceita pagamento.",
};
export function divergenceText(kind: string): string {
  return DIVERGENCE[kind] ?? kind;
}

/** Cartão do plano como o organizador vê ("Até 250 · R$ 189" / "Casamento · 36 fotos por pessoa"). */
export function planPreview(p: { name: string; maxGuests: number | null; maxShots: number | null }, priceCents: number) {
  const guests = p.maxGuests == null ? "Convidados sem limite" : `Até ${int.format(p.maxGuests)}`;
  const shots = p.maxShots == null ? "fotos sem limite" : `${p.maxShots} fotos por pessoa`;
  return { titulo: `${guests} · ${brlShort(priceCents)}`, nota: `${p.name} · ${shots}` };
}

/** Falha de payments-refund depois da solicitação gravada, pelo código de erro do corpo da resposta. */
export function refundFailureText(code: string | undefined): string {
  if (code === "cobranca_nao_paga" || code === "cobranca_nao_confere") {
    return "A AbacatePay já não mostra a cobrança como paga; a conciliação atualiza em até 5 minutos.";
  }
  return "Solicitação registrada, mas o provedor não confirmou o pedido de reembolso. Tente reenviar em alguns minutos.";
}

/** Tradução dos erros das RPCs/função para o operador. */
export function adminErrorText(code: string | undefined, message: string): string {
  if (code === "MM011" || /reasonrequired/.test(message)) return `Escreva o motivo com ${REASON_MIN} a ${REASON_MAX} caracteres.`;
  if (code === "MM004" || /forbidden/.test(message)) return "Sem permissão para esta ação.";
  if (code === "MM005" || /invalid/.test(message)) return "Ação recusada pelo servidor: confira os dados e o estado atual.";
  return "Não foi possível concluir. Tente de novo.";
}
