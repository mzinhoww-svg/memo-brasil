// Cliente mínimo da API v2 da AbacatePay (checkout transparente Pix). Módulo puro: só fetch, sem SDK e sem APIs de Deno,
// para rodar na Edge Function e nos testes. Erros nunca carregam a chave de API nem o corpo bruto da resposta.

export type AbacateConfig = { apiKey: string; baseUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number };

export type AbacateErrorKind = "auth" | "permission" | "rate_limit" | "provider" | "network" | "invalid";

export class AbacateError extends Error {
  readonly kind: AbacateErrorKind;
  /** Status HTTP da resposta; 0 quando não houve resposta (rede, tempo esgotado ou recusa local). */
  readonly status: number;
  /** Código do provedor só quando tem a forma de constante (ex.: TRANSACTION_NOT_REFUNDABLE); texto livre nunca é exposto. */
  readonly providerCode?: string;

  constructor(kind: AbacateErrorKind, status: number, providerCode?: string) {
    super(`AbacatePay: ${kind}${status ? ` (HTTP ${status})` : ""}${providerCode ? ` ${providerCode}` : ""}`);
    this.name = "AbacateError";
    this.kind = kind;
    this.status = status;
    if (providerCode) this.providerCode = providerCode;
  }
}

export type PixCharge = { id: string; status: string; brCode: string; brCodeBase64: string; expiresAt: string; devMode: boolean; amount: number };
export type PixCheck = { id: string; status: string; devMode: boolean; amount?: number; expiresAt?: string };

const DEFAULT_TIMEOUT_MS = 15_000;
const CODE_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
// Resposta documentada de POST /transparents/refund para cobrança já reembolsada (HTTP 400): tratar como "já reembolsado".
const ALREADY_REFUNDED = "Esta cobrança já foi reembolsada.";

type Envelope = { data: Record<string, unknown> | null; error: string | null };

function kindForStatus(status: number): AbacateErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 429) return "rate_limit";
  if (status === 400 || status === 404 || status === 409 || status === 422) return "invalid";
  return "provider";
}

/** `toleratedError`: mensagem de erro documentada que o chamador trata como sucesso (devolve `data: null`). */
async function call(cfg: AbacateConfig, method: "GET" | "POST", path: string, body?: unknown, toleratedError?: string): Promise<Envelope> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}${path}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.apiKey}`, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await doFetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
    text = await res.text();
  } catch {
    // A mensagem original pode conter a URL ou cabeçalhos; não é repassada.
    throw new AbacateError("network", 0);
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const env = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const error = env && typeof env.error === "string" ? env.error : null;
  const code = error && CODE_RE.test(error) ? error : undefined;

  if (toleratedError !== undefined && error === toleratedError) return { data: null, error };
  if (!res.ok) throw new AbacateError(kindForStatus(res.status), res.status, code);
  // Sempre conferir `success`: HTTP 200 com success:false é erro.
  if (!env || env.success !== true) throw new AbacateError("provider", res.status, code);
  const data = env.data && typeof env.data === "object" ? (env.data as Record<string, unknown>) : null;
  return { data, error };
}

const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function requireId(id: string): void {
  if (!str(id)) throw new AbacateError("invalid", 0);
}

/** POST /transparents/create com method PIX. Sem `customer`, para não coletar CPF. */
export async function createPixCharge(
  cfg: AbacateConfig,
  input: { amountCents: number; expiresInSec: number; description: string; externalId: string; metadata: Record<string, string> },
): Promise<PixCharge> {
  const { amountCents, expiresInSec, description, externalId, metadata } = input;
  if (!Number.isInteger(amountCents) || amountCents < 100) throw new AbacateError("invalid", 0);
  if (!Number.isInteger(expiresInSec) || expiresInSec <= 0) throw new AbacateError("invalid", 0);
  if (Object.values(metadata).some((v) => typeof v !== "string")) throw new AbacateError("invalid", 0);

  const { data } = await call(cfg, "POST", "/transparents/create", {
    method: "PIX",
    data: { amount: amountCents, expiresIn: expiresInSec, description, externalId, metadata },
  });
  const d = data ?? {};
  if (!str(d.id) || !str(d.status) || !str(d.brCode) || !str(d.brCodeBase64) || !str(d.expiresAt) || typeof d.devMode !== "boolean" || !num(d.amount)) {
    throw new AbacateError("provider", 200);
  }
  return { id: d.id, status: d.status, brCode: d.brCode, brCodeBase64: d.brCodeBase64, expiresAt: d.expiresAt, devMode: d.devMode, amount: d.amount };
}

/** GET /transparents/check?id= (só Pix). */
export async function checkPixCharge(cfg: AbacateConfig, id: string): Promise<PixCheck> {
  requireId(id);
  const { data } = await call(cfg, "GET", `/transparents/check?id=${encodeURIComponent(id)}`);
  const d = data ?? {};
  if (!str(d.status)) throw new AbacateError("provider", 200);
  const out: PixCheck = {
    id: str(d.id) ? d.id : id,
    status: d.status,
    // A documentação não mostra `devMode` nesta rota; o ambiente é definido pela chave usada.
    devMode: typeof d.devMode === "boolean" ? d.devMode : cfg.apiKey.startsWith("abc_dev_"),
  };
  if (num(d.amount)) out.amount = d.amount;
  if (str(d.expiresAt)) out.expiresAt = d.expiresAt;
  return out;
}

export type PixListItem = { id: string; status: string; devMode: boolean; amount?: number; brCode?: string; brCodeBase64?: string; expiresAt?: string };

/**
 * GET /transparents/list filtrado por `id` ou `externalId` (nunca sem filtro). Serve para recuperar o valor quando a
 * reconsulta (check) não o informa e para achar a cobrança de um pedido cuja criação terminou sem resposta (timeout).
 */
export async function listPixCharges(cfg: AbacateConfig, filter: { id?: string; externalId?: string }): Promise<PixListItem[]> {
  const q = new URLSearchParams();
  if (str(filter.id)) q.set("id", filter.id);
  if (str(filter.externalId)) q.set("externalId", filter.externalId);
  if ([...q.keys()].length === 0) throw new AbacateError("invalid", 0);
  q.set("limit", "10");
  const { data } = await call(cfg, "GET", `/transparents/list?${q.toString()}`);
  const items: unknown[] = Array.isArray(data) ? data : [];
  const out: PixListItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const d = it as Record<string, unknown>;
    if (!str(d.id) || !str(d.status)) continue;
    const item: PixListItem = { id: d.id, status: d.status, devMode: typeof d.devMode === "boolean" ? d.devMode : cfg.apiKey.startsWith("abc_dev_") };
    if (num(d.amount)) item.amount = d.amount;
    if (str(d.brCode)) item.brCode = d.brCode;
    if (str(d.brCodeBase64)) item.brCodeBase64 = d.brCodeBase64;
    if (str(d.expiresAt)) item.expiresAt = d.expiresAt;
    out.push(item);
  }
  return out;
}

/** POST /transparents/refund (reembolso total). Cobrança já reembolsada conta como sucesso (idempotente). */
export async function refundCharge(cfg: AbacateConfig, id: string, reason: string): Promise<void> {
  requireId(id);
  await call(cfg, "POST", "/transparents/refund", { id, reason }, ALREADY_REFUNDED);
}

/** POST /transparents/simulate-payment?id= — só Dev mode; recusa localmente qualquer chave que não seja abc_dev_. */
export async function simulatePixPayment(cfg: AbacateConfig, id: string): Promise<void> {
  if (typeof cfg.apiKey !== "string" || !cfg.apiKey.startsWith("abc_dev_")) throw new AbacateError("invalid", 0);
  requireId(id);
  await call(cfg, "POST", `/transparents/simulate-payment?id=${encodeURIComponent(id)}`);
}
