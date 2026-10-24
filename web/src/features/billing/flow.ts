/** Lógica pura da página de plano (COM-006): estado do pedido -> tela, contagem, idempotência, retorno do checkout, textos. Nenhum valor é calculado aqui, exceto o custo por convidado do TrustBlock, definido pelo plano. */
import { formatBRL } from "./api";
import type { OrderView, PublicPlan } from "./types";

export type PlanScreen = "escolha" | "pendente" | "pago" | "expirado" | "falhou" | "estornado" | "em_disputa";

export function screenFor(order: OrderView | null, now: number): PlanScreen {
  if (!order) return "escolha";
  switch (order.status) {
    case "criado":
    case "pendente":
      return order.expiresAt && Date.parse(order.expiresAt) <= now ? "expirado" : "pendente";
    case "pago": return "pago";
    case "expirado": return "expirado";
    case "estornado": return "estornado";
    case "em_disputa": return "em_disputa";
    default: return "falhou"; // falhou, cancelado, perdido
  }
}

/** `m:ss` até `expiresAt` (arredonda para cima; nunca negativo). */
export function countdown(expiresAt: string | undefined, now: number): string | null {
  if (!expiresAt) return null;
  const secs = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

const memoryKeys = new Map<string, string>();
const slot = (eventId: string, planCode: string) => `mm-idem:${eventId}:${planCode}`;
function newKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}
/** Uma chave por evento e plano na sessão da aba: clique duplo e nova tentativa reusam a mesma intenção de compra. */
export function idempotencyKeyFor(eventId: string, planCode: string): string {
  const k = slot(eventId, planCode);
  try {
    const s = window.sessionStorage.getItem(k);
    if (s) return s;
    const n = newKey();
    window.sessionStorage.setItem(k, n);
    return n;
  } catch {
    const s = memoryKeys.get(k) ?? newKey();
    memoryKeys.set(k, s);
    return s;
  }
}
/** Nova intenção de compra (pagamento expirado ou falho): descarta a chave. */
export function clearIdempotencyKey(eventId: string, planCode: string): void {
  const k = slot(eventId, planCode);
  memoryKeys.delete(k);
  try { window.sessionStorage.removeItem(k); } catch { /* sem armazenamento */ }
}

/** 409 pedido_aberto pode devolver o pedido de OUTRO plano: a UI o mostra com aviso (MM013) em vez de fingir que criou o escolhido. */
export function reconcileCheckout(order: OrderView, wantedPlan: string): { order: OrderView; otherPlan: boolean } {
  return { order, otherPlan: order.planCode !== wantedPlan };
}

/** payment_method_id de cartões no Mercado Pago (o Checkout Pro devolve a bandeira, não "card"). */
const CARD_BRANDS = new Set(["master", "visa", "amex", "elo", "hipercard", "diners", "cabal", "debmaster", "debvisa", "debelo", "naranja", "cmr"]);

/** Forma de pagamento para o comprovante. Desconhecida cai no nome do provedor; pedido histórico AbacatePay era sempre Pix. */
export function paymentLabel(order: Pick<OrderView, "paymentMethod" | "provider">): string {
  const m = order.paymentMethod;
  if (m === "pix") return "Pix";
  if (m === "card" || m === "credit_card" || m === "debit_card" || (m && CARD_BRANDS.has(m))) return "Cartão";
  return order.provider === "abacatepay" ? "Pix (AbacatePay)" : "Mercado Pago";
}

export type ReturnHint = "sucesso" | "pendente" | "falha";
/** Parâmetros que o Mercado Pago anexa às back_urls, mais o `retorno` do próprio app. Todos são só dica de UX. */
const RETURN_PARAMS = [
  "retorno", "payment_id", "status", "collection_id", "collection_status", "external_reference", "preference_id", "payment_type",
  "merchant_order_id", "site_id", "processing_mode", "merchant_account_id",
] as const;

/** Lê a dica `?retorno=` e devolve a query sem os parâmetros do retorno (preserva `plano` e demais). Nada aqui libera plano. */
export function parseReturn(search: string): { hint: ReturnHint | null; search: string } {
  const q = new URLSearchParams(search);
  const raw = q.get("retorno");
  const hint: ReturnHint | null = raw === "sucesso" || raw === "pendente" || raw === "falha" ? raw : null;
  for (const k of RETURN_PARAMS) q.delete(k);
  const rest = q.toString();
  return { hint, search: rest ? `?${rest}` : "" };
}

/** Posição do plano na lista do servidor (já ordenada); desconhecido = 0 (piso). */
export function planRank(plans: PublicPlan[], code: string | null): number {
  const i = plans.findIndex((p) => p.code === code);
  return i < 0 ? 0 : i;
}

export function joinGuests(maxGuests: number | null, maxShots: number | null): string {
  const g = maxGuests === null ? "convidados sem limite" : `${maxGuests} convidados`;
  const s = maxShots === null ? "fotos sem limite" : `${maxShots} fotos cada`;
  return maxGuests === null ? `Convidados sem limite e ${s}.` : `Até ${g} e ${s}.`;
}

/** "{n} olhares por R$ x cada." (Grande usa 500; omitido no Grátis). */
export function trustTitle(plan: PublicPlan): string | null {
  if (plan.isFree || plan.priceCents <= 0) return null;
  const n = plan.maxGuests ?? 500;
  return `${n} olhares por ${formatBRL(plan.priceCents / n)} cada.`;
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

export const PLAN_TEXT = {
  titulo: "De que tamanho é a festa?",
  sub: "Pagamento único por evento, no Mercado Pago. Cartão ou Pix, conforme disponível. Sem assinatura.",
  expirado: "Nada foi cobrado. Quando quiser, comece um novo pagamento.",
  provedor: "Seu pedido está guardado; tente de novo em 1 minuto.",
  outroPlano: (nome: string) => `Você já tem um pagamento aberto do plano ${nome}. Conclua esse ou deixe expirar antes de escolher outro plano.`,
} as const;

/** Mensagem de recuperação para erros do checkout (sem expor códigos técnicos). */
export function checkoutErrorMessage(code: string): string {
  switch (code) {
    case "ja_incluido": return "Seu evento já tem este plano ou um maior.";
    case "plano_inativo": return "Este plano não está à venda agora. Escolha outro.";
    case "evento_encerrado": return "Este evento já terminou. Não dá para mudar o plano.";
    case "valor_minimo": return "Não há valor a pagar por esta mudança de plano.";
    case "pedido_aberto": return "Já existe um pagamento aberto para este evento. Atualize a página para vê-lo.";
    case "unauthorized": case "forbidden": return "Só o anfitrião pode mudar o plano. Entre com a conta que criou o evento.";
    default: return "Não foi possível seguir agora. Nada foi cobrado; tente de novo em instantes.";
  }
}

export const QUOTE_BLOCK: Record<string, string> = {
  ja_incluido: "Seu evento já tem este plano ou um maior.",
  plano_inativo: "Este plano não está à venda agora.",
  evento_encerrado: "Este evento já terminou. Não dá para mudar o plano.",
  valor_minimo: "Não há valor a pagar por esta mudança.",
};
