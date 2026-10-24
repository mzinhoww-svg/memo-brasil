// Peças puras do fluxo Mercado Pago (sem Deno): origem/back_urls, leitura de notificação e varredura paginada por pedido.
import { isAllowedOrigin } from "./cors.ts";
import { searchPayments, type MercadoPagoConfig, type MpPayment } from "./mercadopago.ts";

export const OFFICIAL_ORIGIN = "https://newmemocuiaba.vercel.app";
export const PREFERENCE_TTL_MIN = 60;

/** Origem das back_urls: em produção só o domínio oficial ou ALLOWED_ORIGINS; previews/localhost só em sandbox. */
export function pickOrigin(origin: string | null | undefined, extra: string, env: "sandbox" | "production"): string {
  if (!origin) return OFFICIAL_ORIGIN;
  const extras = extra.split(",").map((s) => s.trim()).filter(Boolean);
  if (origin === OFFICIAL_ORIGIN || extras.includes(origin)) return origin;
  if (env === "sandbox" && isAllowedOrigin(origin, extra)) return origin;
  return OFFICIAL_ORIGIN;
}

export function buildBackUrls(origin: string, eventId: string): { success: string; pending: string; failure: string } {
  const base = `${origin}/painel/${eventId}/plano?retorno=`;
  return { success: `${base}sucesso`, pending: `${base}pendente`, failure: `${base}falha` };
}

export type Notification = { type: string | null; action: string | null; dataId: string | null; liveMode: boolean | null; dateCreated: string | null };

/** Lê tipo, ação e data.id. A query tem preferência para data.id (é o que entra no manifest assinado). Nunca lança. */
export function parseNotification(rawBody: string, url: string): Notification {
  let body: Record<string, unknown> = {};
  try {
    const p = JSON.parse(rawBody);
    if (p && typeof p === "object" && !Array.isArray(p)) body = p as Record<string, unknown>;
  } catch { /* corpo vazio ou inválido: usa só a query */ }
  let q = new URLSearchParams();
  try { q = new URL(url).searchParams; } catch { /* url inválida */ }
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  const bodyId = typeof data.id === "string" || typeof data.id === "number" ? String(data.id) : null;
  const qType = q.get("type") ?? q.get("topic");
  return {
    type: typeof body.type === "string" ? body.type : qType,
    action: typeof body.action === "string" ? body.action : null,
    dataId: q.get("data.id") ?? q.get("id") ?? bodyId,
    liveMode: typeof body.live_mode === "boolean" ? body.live_mode : null,
    dateCreated: typeof body.date_created === "string" ? body.date_created : null,
  };
}

export function notificationEventKey(n: Notification, requestId: string | null): string {
  return `mp:${n.type ?? "x"}:${n.dataId ?? "x"}:${n.action ?? "x"}:${n.dateCreated ?? requestId ?? "x"}`;
}

/**
 * Pagamentos de um pedido por external_reference, paginando com teto (conciliação). `complete=false` quando parou no
 * teto sem ver o fim: busca incompleta nunca falha o pedido. O deslocamento avança pelo que a página devolveu.
 */
export async function collectPayments(
  cfg: MercadoPagoConfig, externalReference: string, o: { pageSize: number; maxPages: number },
): Promise<{ payments: MpPayment[]; complete: boolean }> {
  const payments: MpPayment[] = [];
  let offset = 0;
  for (let i = 0; i < o.maxPages; i++) {
    const page = await searchPayments(cfg, { externalReference, limit: o.pageSize, offset });
    payments.push(...page.results);
    offset += page.results.length;
    if (page.results.length === 0 || offset >= page.total) return { payments, complete: true };
  }
  return { payments, complete: false };
}

/**
 * Por que payments-refund não pode reembolsar (null = pode). `target` vem de payments_refund_target (o banco decide qual
 * pagamento é alvo: o vinculado ou uma cobrança extra explícita); com `payment` (reconsulta obrigatória antes do POST):
 * aprovado, do pedido (external_reference), recebedor e ambiente conferem; o valor só é exigido no primário, porque a cobrança
 * extra é justamente dinheiro com valor ou duplicidade diferentes.
 */
export function refundBlocker(
  order: { id: string; provider: string; status: string; provider_env: "sandbox" | "production"; amount_cents: number },
  target: { kind: "primary" | "extra"; requestedAt: string | null },
  payment?: MpPayment,
  expectedCollector?: string | null,
): "provedor_historico" | "reembolso_nao_solicitado" | "estado_invalido" | "cobranca_nao_paga" | "cobranca_nao_confere" | "recebedor_divergente" | "ambiente_divergente" | null {
  if (order.provider !== "mercadopago") return "provedor_historico";
  if (!target.requestedAt) return "reembolso_nao_solicitado";
  if (target.kind === "primary" && order.status !== "pago") return "estado_invalido";
  if (!payment) return null;
  if (payment.status !== "approved") return "cobranca_nao_paga";
  if (payment.externalReference !== order.id) return "cobranca_nao_confere";
  if (target.kind === "primary" && payment.amountCents !== order.amount_cents) return "cobranca_nao_confere";
  if (!expectedCollector || payment.collectorId !== expectedCollector) return "recebedor_divergente";
  if (payment.liveMode === null || payment.liveMode !== (order.provider_env === "production")) return "ambiente_divergente";
  return null;
}
