/**
 * Camada de billing do web (sem UI). Preço, plano e status vêm do servidor; nada aqui calcula valor.
 *
 * Funções públicas:
 * - `listPublicPlans(): Promise<PublicPlan[]>` — RPC `list_public_plans` (anon ou logado). Modo local: só o Grátis.
 * - `getPublicSettings(): Promise<PublicSettings>` — RPC `get_public_settings`. Modo local: tudo nulo, `paymentsEnv: "desligado"`.
 * - `quote(eventId, planCode): Promise<Quote>` — RPC `payments_quote` (só o anfitrião). `reason` diz por que não é cobrável.
 * - `startCheckout(eventId, planCode, idempotencyKey): Promise<OrderView>` — Edge Function `payments-checkout`; devolve
 *   `checkoutUrl` (Checkout Pro do Mercado Pago; a UI navega até ela) e `provider`. Sem `brCode`/`brCodeBase64`.
 *   Gere `idempotencyKey` com `crypto.randomUUID()` uma vez por intenção de compra e reuse em novas tentativas.
 *   409 `pedido_aberto` devolve o pedido aberto existente (confira `planCode`: pode ser de outro plano); se não houver
 *   pedido realmente aberto, relança `OpenOrderError` (código `pedido_aberto`). O 200 não traz `paidAt` (nem `planCode`, que
 *   vem do plano pedido): use `orderStatus` para o estado completo.
 * - `orderStatus(orderId): Promise<OrderView>` — Edge Function `payments-status` (reconsulta o provedor se pendente > 15 s).
 * - `openOrder(eventId): Promise<OrderView | null>` — pedido aberto (criado/pendente não vencido) do evento ou, sem ele, o
 *   mais recente; `null` se nunca houve pedido. Se a reconsulta der 404/MM004 (evento excluído), devolve os dados da
 *   linha; 503 e outros erros propagam.
 * - Enums do servidor são validados: status desconhecido → "falhou"; motivo de cotação desconhecido → "plano_inativo"
 *   com `payable: false`; motivo de resgate desconhecido → "invalido".
 * - `redeemCode(eventId, code): Promise<RedeemResult>` — RPC `redeem_code`; normaliza o código antes. Motivos de recusa
 *   (`invalido`, `ja_incluido`, `muitas_tentativas`, `evento_encerrado`) voltam no resultado, não como exceção.
 * - `normalizeCode(input): string` — maiúsculas, sem espaços, no formato `MMT-XXXX-XXXX` quando reconhecível.
 * - `formatBRL(cents): string` — `18900` → `"R$ 189,00"`.
 *
 * Erros (todos `instanceof BillingError`, com `code` e `status`):
 * - `BillingUnavailableError` — modo local, pagamentos desligados (503 / MM014).
 * - `ProviderUnavailableError` — 502: provedor falhou; `orderId` é o pedido mantido (consulte com `orderStatus` depois).
 * - `BillingError` — demais: `code` ∈ plano_inativo | ja_incluido | evento_encerrado | valor_minimo (422), invalid (400),
 *   unauthorized (401), forbidden (403), nao_encontrado (404), ou o código do banco (ex.: MM004) nas RPCs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import type { OrderStatus, OrderView, PaymentProvider, PaymentsEnv, PublicPlan, PublicSettings, Quote, QuoteReason, RedeemReason, RedeemResult } from "./types";

export type { OrderStatus, OrderView, PaymentProvider, PaymentsEnv, PublicPlan, PublicSettings, Quote, QuoteReason, RedeemReason, RedeemResult } from "./types";

export class BillingError extends Error {
  constructor(readonly code: string, readonly status?: number, message?: string) {
    super(message ?? code);
    this.name = "BillingError";
  }
}
export class BillingUnavailableError extends BillingError {
  constructor(message = "Pagamento indisponível no momento") {
    super("pagamento_indisponivel", 503, message);
    this.name = "BillingUnavailableError";
  }
}
/** 409 `pedido_aberto` sem pedido localizável. `orderId` é o pedido aberto informado pelo servidor (pode ser de OUTRO plano). */
export class OpenOrderError extends BillingError {
  constructor(readonly orderId: string | null) {
    super("pedido_aberto", 409, "Já existe um pagamento aberto para este evento");
    this.name = "OpenOrderError";
  }
}
export class ProviderUnavailableError extends BillingError {
  constructor(readonly orderId: string | null) {
    super("provedor_indisponivel", 502, "O provedor de pagamento não respondeu");
    this.name = "ProviderUnavailableError";
  }
}

/** Plano grátis do modo local (sem servidor): mesmos limites aprovados do plano Grátis. */
const LOCAL_FREE_PLAN: PublicPlan = { code: "gratis", name: "Grátis", maxGuests: 10, maxShots: 10, priceCents: 0, isFree: true, features: [] };

function client(): SupabaseClient {
  if (backendMode() !== "supabase") throw new BillingUnavailableError();
  return browserSupabase();
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100).replace(/\s/g, " "); // Intl usa espaço não separável
}

export function normalizeCode(input: string): string {
  const compact = input.toUpperCase().replace(/[\s-]+/g, "");
  const body = compact.startsWith("MMT") && compact.length === 11 ? compact.slice(3) : compact.length === 8 ? compact : null;
  return body && /^[A-Z0-9]{8}$/.test(body) ? `MMT-${body.slice(0, 4)}-${body.slice(4)}` : compact;
}

// ---------------------------------------------------------------- mapeamento
type Json = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);

// enums do servidor: valor desconhecido nunca vira estado otimista
const ORDER_STATUSES: readonly OrderStatus[] = ["criado", "pendente", "pago", "expirado", "cancelado", "falhou", "estornado", "em_disputa", "perdido"];
const QUOTE_REASONS: readonly QuoteReason[] = ["ok", "ja_incluido", "plano_inativo", "evento_encerrado", "valor_minimo"];
const REDEEM_REASONS: readonly RedeemReason[] = ["ok", "ja_incluido", "invalido", "muitas_tentativas", "evento_encerrado"];
const oneOf = <T extends string>(v: unknown, all: readonly T[], fallback: T): T => (all.includes(v as T) ? (v as T) : fallback);
/** Status desconhecido vira "falhou": não aberto, sem direito concedido. */
const toStatus = (v: unknown): OrderStatus => oneOf(v, ORDER_STATUSES, "falhou");

const PROVIDERS: readonly PaymentProvider[] = ["mercadopago", "abacatepay"];
/** Provedor desconhecido cai em "mercadopago" (provedor ativo); pedidos históricos vêm com "abacatepay" explícito. */
const toProvider = (v: unknown): PaymentProvider => oneOf(v, PROVIDERS, "mercadopago");

/** Só navega para https; http só em loopback (fake local de testes). Qualquer outra coisa é descartada. */
export function safeCheckoutUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  try {
    const u = new URL(v);
    if (u.protocol === "https:") return u.toString();
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]")) return u.toString();
  } catch { /* não é URL absoluta */ }
  return undefined;
}

function toOrderView(j: Json, fallbackPlan?: string): OrderView {
  const v: OrderView = {
    orderId: String(j.orderId),
    status: toStatus(j.status),
    planCode: str(j.planCode) ?? fallbackPlan ?? "",
    amountCents: Number(j.amountCents),
    provider: toProvider(j.provider),
  };
  const opt = { checkoutUrl: safeCheckoutUrl(j.checkoutUrl), expiresAt: str(j.expiresAt), paidAt: str(j.paidAt), paymentMethod: str(j.paymentMethod) };
  for (const [k, val] of Object.entries(opt)) if (val !== undefined) (v as Json)[k] = val;
  return v;
}

function rowToOrderView(r: Json): OrderView {
  return toOrderView({
    orderId: r.id, status: r.status, planCode: r.plan_code, amountCents: r.amount_cents, provider: r.provider,
    checkoutUrl: r.checkout_url, paymentMethod: r.payment_method, expiresAt: r.expires_at, paidAt: r.paid_at,
  });
}

function rpcError(e: { code?: string; message?: string }): BillingError {
  if (e.code === "MM014") return new BillingUnavailableError();
  return new BillingError(e.code ?? "erro", undefined, e.message);
}

async function rpc<T>(fn: string, args?: Json): Promise<T> {
  const r = await client().rpc(fn, args);
  if (r.error) throw rpcError(r.error);
  return r.data as T;
}

/** Corpo e status de erro de Edge Function (FunctionsHttpError.context é o Response). */
async function fnError(err: unknown): Promise<BillingError> {
  const ctx = (err as { context?: unknown }).context;
  let status: number | undefined;
  let body: Json = {};
  if (ctx instanceof Response) {
    status = ctx.status;
    try { body = (await ctx.json()) as Json; } catch { /* corpo ilegível */ }
  }
  const code = typeof body.error === "string" ? body.error : "indisponivel";
  if (status === 503 || code === "pagamento_indisponivel") return new BillingUnavailableError();
  if (status === 502 || code === "provedor_indisponivel") return new ProviderUnavailableError(strOrNull(body.orderId));
  if (code === "pedido_aberto") return new OpenOrderError(strOrNull(body.orderId));
  return new BillingError(code, status);
}

async function invoke(fn: string, body: Json): Promise<Json> {
  const r = await client().functions.invoke(fn, { body });
  if (r.error) throw await fnError(r.error);
  return r.data as Json;
}

// ---------------------------------------------------------------- API
export async function listPublicPlans(): Promise<PublicPlan[]> {
  if (backendMode() !== "supabase") return [{ ...LOCAL_FREE_PLAN }];
  const data = await rpc<Json[] | null>("list_public_plans");
  return (data ?? []).map((p) => ({
    code: String(p.code),
    name: String(p.name),
    maxGuests: numOrNull(p.maxGuests),
    maxShots: numOrNull(p.maxShots),
    priceCents: Number(p.priceCents),
    isFree: p.isFree === true,
    features: Array.isArray(p.features) ? p.features.filter((f): f is string => typeof f === "string") : [],
  }));
}

export async function getPublicSettings(): Promise<PublicSettings> {
  if (backendMode() !== "supabase") {
    return { supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "desligado", capacityGracePct: 0 };
  }
  const s = (await rpc<Json | null>("get_public_settings")) ?? {};
  const env = s.payments_env;
  return {
    supportEmail: strOrNull(s.support_email),
    supportPhone: strOrNull(s.support_phone),
    companyLegalName: strOrNull(s.company_legal_name),
    companyCnpj: strOrNull(s.company_cnpj),
    paymentsEnv: env === "sandbox" || env === "production" ? (env as PaymentsEnv) : "desligado",
    capacityGracePct: typeof s.capacity_grace_pct === "number" ? s.capacity_grace_pct : Number(s.capacity_grace_pct ?? 0) || 0,
  };
}

export async function quote(eventId: string, planCode: string): Promise<Quote> {
  const q = await rpc<Json>("payments_quote", { p_event: eventId, p_plan: planCode });
  const reason = oneOf(q.reason, QUOTE_REASONS, "plano_inativo");
  return {
    planCode: String(q.planCode),
    fromPlanCode: strOrNull(q.fromPlanCode),
    amountCents: Number(q.amountCents),
    payable: q.payable === true && reason === "ok",
    reason,
  };
}

export async function orderStatus(orderId: string): Promise<OrderView> {
  return toOrderView(await invoke("payments-status", { orderId }));
}

export async function startCheckout(eventId: string, planCode: string, idempotencyKey: string): Promise<OrderView> {
  try {
    return toOrderView(await invoke("payments-checkout", { eventId, planCode, idempotencyKey }), planCode);
  } catch (e) {
    if (e instanceof OpenOrderError) {
      if (e.orderId) return orderStatus(e.orderId);
      // sem orderId: só serve um pedido realmente aberto; o mais recente de outro status não substitui o 409
      const { open } = await readOrders(eventId);
      if (open) return refresh(rowToOrderView(open));
    }
    throw e;
  }
}

const OPEN: readonly OrderStatus[] = ["criado", "pendente"];
const CREATED_TTL_MS = 30 * 60_000; // igual ao servidor: 'criado' sem cobrança vence em 30 min

/** Aberto = criado/pendente e não vencido (expires_at futuro; sem expires_at, criado há menos de 30 min). */
function isOpenRow(x: Json, now: number): boolean {
  if (!OPEN.includes(toStatus(x.status))) return false;
  if (x.expires_at != null) return Date.parse(String(x.expires_at)) > now;
  return x.created_at != null && Date.parse(String(x.created_at)) > now - CREATED_TTL_MS;
}

async function readOrders(eventId: string): Promise<{ open: Json | undefined; latest: Json | undefined }> {
  const r = await client().from("payment_orders")
    .select("id,status,plan_code,amount_cents,provider,checkout_url,payment_method,expires_at,paid_at,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (r.error) throw rpcError(r.error);
  const rows = (r.data ?? []) as Json[];
  const now = Date.now();
  return { open: rows.find((x) => isOpenRow(x, now)), latest: rows[0] };
}

/** Reconsulta pedidos não terminais. Só 404/MM004 (evento excluído ou purgado) cai nos dados da linha; o resto propaga. */
async function refresh(view: OrderView): Promise<OrderView> {
  if (!OPEN.includes(view.status)) return view;
  try {
    return await orderStatus(view.orderId);
  } catch (e) {
    if (e instanceof BillingError && (e.status === 404 || e.code === "nao_encontrado" || e.code === "MM004")) return view;
    throw e;
  }
}

export async function openOrder(eventId: string): Promise<OrderView | null> {
  const { open, latest } = await readOrders(eventId);
  const row = open ?? latest;
  return row ? refresh(rowToOrderView(row)) : null;
}

export async function redeemCode(eventId: string, code: string): Promise<RedeemResult> {
  const r = await rpc<Json>("redeem_code", { p_event: eventId, p_code: normalizeCode(code) });
  return { applied: r.applied === true, planCode: strOrNull(r.planCode), reason: oneOf(r.reason, REDEEM_REASONS, "invalido") };
}
