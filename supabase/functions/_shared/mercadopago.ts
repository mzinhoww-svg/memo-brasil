// Cliente mínimo da API do Mercado Pago (Checkout Pro por Preferences). Módulo puro: só fetch (injetável), sem SDK e sem APIs
// de Deno. Erros tipados nunca carregam o token nem o corpo bruto da resposta. Valores monetários da API são em reais;
// internamente tudo é em centavos (inteiros). Incertezas de documentação: design §6.

export type MercadoPagoConfig = { accessToken: string; baseUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number };

export type MercadoPagoErrorKind = "auth" | "permission" | "rate_limit" | "provider" | "network" | "timeout" | "invalid" | "bad_response";

export class MercadoPagoError extends Error {
  readonly kind: MercadoPagoErrorKind;
  /** Status HTTP; 0 quando não houve resposta (rede, tempo esgotado ou recusa local). */
  readonly status: number;
  /** Código do provedor só quando tem forma de constante (ex.: idempotency_key_already_used); texto livre nunca é exposto. */
  readonly providerCode?: string;
  constructor(kind: MercadoPagoErrorKind, status: number, providerCode?: string) {
    super(`MercadoPago: ${kind}${status ? ` (HTTP ${status})` : ""}${providerCode ? ` ${providerCode}` : ""}`);
    this.name = "MercadoPagoError";
    this.kind = kind;
    this.status = status;
    if (providerCode) this.providerCode = providerCode;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const CODE_RE = /^[a-z][a-z0-9_]{2,63}$/;
const PAYMENT_ID_RE = /^[0-9A-Za-z_-]{1,40}$/;
export const SEARCH_MAX_LIMIT = 50; // máximo documentado

function kindForStatus(s: number): MercadoPagoErrorKind {
  if (s === 401) return "auth";
  if (s === 403) return "permission";
  if (s === 429) return "rate_limit";
  if (s >= 400 && s < 500) return "invalid";
  return "provider";
}

type Json = Record<string, unknown>;

async function call(cfg: MercadoPagoConfig, method: "GET" | "POST", path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<Json> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}${path}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.accessToken}`, Accept: "application/json", ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response, text: string;
  try {
    res = await doFetch(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: ctrl.signal });
    text = await res.text();
  } catch {
    // a mensagem original pode conter URL ou cabeçalhos: não é repassada
    throw new MercadoPagoError(timedOut ? "timeout" : "network", 0);
  } finally {
    clearTimeout(timer);
  }
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Json) : null;
  const codeRaw = body && typeof body.error === "string" ? body.error : undefined;
  const code = codeRaw && CODE_RE.test(codeRaw) ? codeRaw : undefined;
  if (!res.ok) throw new MercadoPagoError(kindForStatus(res.status), res.status, code);
  if (!body) throw new MercadoPagoError("bad_response", res.status);
  return body;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
/** Reais (número) → centavos inteiros, sem erro de ponto flutuante. */
export const toCents = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) : null);
const toReais = (cents: number) => Math.round(cents) / 100;

// ---------------------------------------------------------------- preferências
export type PreferenceInput = {
  orderId: string; eventId: string; planCode: string; title: string; amountCents: number;
  notificationUrl: string; backUrls: { success: string; pending: string; failure: string };
  expiresAt: string; now: string;
  /** Opcionais do checklist de qualidade do MP (só enviados quando informados). */
  payerEmail?: string | null; description?: string | null;
};
export type Preference = { id: string; initPoint: string; collectorId: string | null; expirationDateTo: string | null };

export async function createPreference(cfg: MercadoPagoConfig, i: PreferenceInput): Promise<Preference> {
  const r = await call(cfg, "POST", "/checkout/preferences", {
    body: {
      items: [{
        id: i.planCode, title: i.title, quantity: 1, currency_id: "BRL", unit_price: toReais(i.amountCents), category_id: "services",
        ...(i.description ? { description: i.description.slice(0, 250) } : {}),
      }],
      ...(i.payerEmail ? { payer: { email: i.payerEmail } } : {}),
      statement_descriptor: "MEMORIESMT",
      // Produto: Pix e cartão, pagamento único. Boleto (ticket) e caixa eletrônico (atm) ficam de fora; cartões e Pix (bank_transfer) permitidos.
      payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
      external_reference: i.orderId,
      notification_url: i.notificationUrl,
      back_urls: i.backUrls,
      auto_return: "approved",
      expires: true,
      expiration_date_from: i.now,
      expiration_date_to: i.expiresAt,
      metadata: { order_id: i.orderId, event_id: i.eventId, plan_code: i.planCode },
    },
  });
  const id = str(r.id), initPoint = str(r.init_point);
  if (!id || !initPoint || !initPoint.startsWith("https://")) throw new MercadoPagoError("bad_response", 200);
  return { id, initPoint, collectorId: str(r.collector_id), expirationDateTo: str(r.expiration_date_to) };
}

export async function searchPreferences(cfg: MercadoPagoConfig, limit = 1): Promise<{ total: number }> {
  const r = await call(cfg, "GET", `/checkout/preferences/search?limit=${Math.min(Math.max(limit, 1), SEARCH_MAX_LIMIT)}`);
  const paging = r.paging && typeof r.paging === "object" ? (r.paging as Json) : {};
  const total = typeof paging.total === "number" ? paging.total : Array.isArray(r.elements) ? r.elements.length : 0;
  return { total };
}

// ---------------------------------------------------------------- pagamentos
export type MpPayment = {
  id: string; status: string; amountCents: number | null; currency: string | null; liveMode: boolean | null;
  collectorId: string | null; externalReference: string | null; method: string | null; updatedAt: string | null; refundedCents: number;
  /** Motivo do estado (ex.: cc_rejected_high_risk). Não é dado pessoal. */
  statusDetail: string | null;
  /** Pagador == recebedor? Só o booleano; o id do pagador nunca sai daqui. null se a API não trouxe os dois. */
  payerIsCollector: boolean | null;
};

/** Normaliza o pagamento da API. Descarta pagador e qualquer dado pessoal. */
export function normalizePayment(raw: Json): MpPayment {
  const id = str(raw.id), status = typeof raw.status === "string" ? raw.status : null;
  if (!id || !status) throw new MercadoPagoError("bad_response", 200);
  let updatedAt: string | null = null;
  if (typeof raw.date_last_updated === "string") {
    const t = Date.parse(raw.date_last_updated);
    updatedAt = Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  return {
    id, status,
    amountCents: toCents(raw.transaction_amount),
    currency: typeof raw.currency_id === "string" ? raw.currency_id : null,
    liveMode: typeof raw.live_mode === "boolean" ? raw.live_mode : null,
    collectorId: str(raw.collector_id),
    externalReference: typeof raw.external_reference === "string" && raw.external_reference ? raw.external_reference : null,
    method: typeof raw.payment_method_id === "string" ? raw.payment_method_id : null,
    updatedAt,
    refundedCents: toCents(raw.transaction_amount_refunded) ?? 0,
    statusDetail: typeof raw.status_detail === "string" && raw.status_detail ? raw.status_detail : null,
    payerIsCollector: (() => {
      const payer = raw.payer && typeof raw.payer === "object" ? str((raw.payer as Json).id) : null;
      const col = str(raw.collector_id);
      return payer && col ? payer === col : null;
    })(),
  };
}

export async function getPayment(cfg: MercadoPagoConfig, paymentId: string): Promise<MpPayment> {
  if (!PAYMENT_ID_RE.test(paymentId)) throw new MercadoPagoError("invalid", 0);
  return normalizePayment(await call(cfg, "GET", `/v1/payments/${paymentId}`));
}

export async function searchPayments(
  cfg: MercadoPagoConfig, q: { externalReference: string; limit: number; offset: number },
): Promise<{ total: number; limit: number; offset: number; results: MpPayment[] }> {
  const limit = Math.min(Math.max(Math.floor(q.limit), 1), SEARCH_MAX_LIMIT);
  const offset = Math.max(Math.floor(q.offset), 0);
  const qs = new URLSearchParams({ external_reference: q.externalReference, limit: String(limit), offset: String(offset), sort: "date_last_updated", criteria: "asc" });
  const r = await call(cfg, "GET", `/v1/payments/search?${qs}`);
  const paging = r.paging && typeof r.paging === "object" ? (r.paging as Json) : {};
  const results: MpPayment[] = [];
  for (const x of Array.isArray(r.results) ? r.results : []) {
    try { if (x && typeof x === "object") results.push(normalizePayment(x as Json)); } catch { /* item sem id/status: descartado */ }
  }
  return { total: typeof paging.total === "number" ? paging.total : results.length, limit, offset, results };
}

// ---------------------------------------------------------------- reembolso
export async function refundIdempotencyKey(orderId: string, paymentId: string, requestedAt: string, amountCents: number | null): Promise<string> {
  const data = new TextEncoder().encode(`refund|${orderId}|${paymentId}|${requestedAt}|${amountCents ?? "total"}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return "mm-" + Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join(""); // 35 caracteres
}

export async function refundPayment(
  cfg: MercadoPagoConfig, paymentId: string, o: { idempotencyKey: string; amountCents?: number | null },
): Promise<{ id: string; status: string; amountCents: number | null }> {
  if (!PAYMENT_ID_RE.test(paymentId) || o.idempotencyKey.length < 1 || o.idempotencyKey.length > 64) throw new MercadoPagoError("invalid", 0);
  const r = await call(cfg, "POST", `/v1/payments/${paymentId}/refunds`, {
    body: o.amountCents ? { amount: toReais(o.amountCents) } : {},
    headers: { "X-Idempotency-Key": o.idempotencyKey, "X-Render-In-Process-Refunds": "true" },
  });
  const id = str(r.id), status = typeof r.status === "string" ? r.status : null;
  if (!id || !status) throw new MercadoPagoError("bad_response", 201);
  return { id, status, amountCents: toCents(r.amount) };
}

// ---------------------------------------------------------------- diagnóstico e conta recebedora
// testUser vem da tag `test_user` que a própria API põe na conta (true/false) ou null se a API não devolver tags.
// Nunca se deduz o ambiente do prefixo do token (teste e produção começam ambos com APP_USR).
export async function getMe(cfg: MercadoPagoConfig): Promise<{ id: string; siteId: string | null; countryId: string | null; testUser: boolean | null }> {
  const r = await call(cfg, "GET", "/users/me");
  const id = str(r.id);
  if (!id) throw new MercadoPagoError("bad_response", 200);
  const tags = Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t): t is string => typeof t === "string") : null;
  return { id, siteId: str(r.site_id), countryId: str(r.country_id), testUser: tags ? tags.includes("test_user") : null };
}


// ---------------------------------------------------------------- Checkout Transparente (Payments API, sem redirecionar)
// Campos do cartão chegam tokenizados pelo Brick no backend. PAN e CVV nunca passam neste módulo.
export type EmbeddedPaymentInput = {
  orderId: string;
  amountCents: number;
  paymentMethodId: string;
  payerEmail: string;
  payerDocument: { type: "CPF"; number: string };
  card?: { token: string; installments: number; issuerId?: number };
  description: string;
  notificationUrl: string;
};

export type EmbeddedPaymentReceipt = {
  paymentId: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  statusDetail: string | null;
};

function embeddedReceipt(raw: Json): EmbeddedPaymentReceipt {
  const id = str(raw.id);
  const status = str(raw.status);
  if (!id || !status) throw new MercadoPagoError("bad_response", 200);
  const poi = raw.point_of_interaction && typeof raw.point_of_interaction === "object"
    ? (raw.point_of_interaction as Json) : {};
  const details = poi.transaction_data && typeof poi.transaction_data === "object"
    ? (poi.transaction_data as Json) : {};
  const pix = str(details.qr_code);
  const base64 = str(details.qr_code_base64);
  return {
    paymentId: id,
    status,
    // Nunca refletir URL arbitrária ou payload HTML; só string de Pix e PNG/base64 limitado.
    qrCode: pix && pix.length <= 4096 ? pix : null,
    qrCodeBase64: base64 && base64.length <= 512000 && /^[A-Za-z0-9+/=]+$/.test(base64) ? base64 : null,
    statusDetail: str(raw.status_detail),
  };
}

/** Idempotência por orderId persistido pelo servidor: o cliente NUNCA controla o valor cobrado. */
export async function createEmbeddedPayment(cfg: MercadoPagoConfig, i: EmbeddedPaymentInput): Promise<EmbeddedPaymentReceipt> {
  if (!UUID_SAFE.test(i.orderId) || !/^[a-z0-9_]{3,32}$/.test(i.paymentMethodId) ||
      !Number.isSafeInteger(i.amountCents) || i.amountCents <= 0 ||
      !/^[0-9]{11}$/.test(i.payerDocument.number) || i.payerDocument.type !== "CPF" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.payerEmail)) throw new MercadoPagoError("invalid", 0);
  if (i.card && (!/^[A-Za-z0-9_-]{12,256}$/.test(i.card.token) ||
      !Number.isInteger(i.card.installments) || i.card.installments < 1 || i.card.installments > 12)) throw new MercadoPagoError("invalid", 0);
  const raw = await call(cfg, "POST", "/v1/payments", {
    headers: { "X-Idempotency-Key": i.orderId },
    body: {
      transaction_amount: toReais(i.amountCents),
      external_reference: i.orderId,
      description: i.description.slice(0, 120),
      statement_descriptor: "MEMORIESMT",
      notification_url: i.notificationUrl,
      payment_method_id: i.paymentMethodId,
      ...(i.card ? {
        token: i.card.token, installments: i.card.installments,
        ...(i.card.issuerId ? { issuer_id: i.card.issuerId } : {}),
      } : {}),
      payer: { email: i.payerEmail, identification: i.payerDocument },
    },
  });
  return embeddedReceipt(raw);
}

const UUID_SAFE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Apenas para um pedido já autorizado como pertencente ao organizador. Não retornar pagador/cartão. */
export async function getEmbeddedReceipt(cfg: MercadoPagoConfig, paymentId: string): Promise<EmbeddedPaymentReceipt> {
  if (!PAYMENT_ID_RE.test(paymentId)) throw new MercadoPagoError("invalid", 0);
  return embeddedReceipt(await call(cfg, "GET", "/v1/payments/" + paymentId));
}
