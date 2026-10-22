// Peças comuns das Edge Functions de pagamento (só Deno: lê Deno.env e cria clientes Supabase).
// Nunca registra chave, brCode, corpo bruto nem dados do pagador: o log é só {fn, orderId, status, outcome}.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AbacateError, checkPixCharge, getPixCharge, type AbacateConfig, type PixListItem } from "./abacatepay.ts";
import { corsHeaders } from "./cors.ts";
import { resolveAbacateConfig, type ProviderEnv } from "./payments-config.ts";
import { mapProviderStatus, type PaymentStatus } from "./payments-status.ts";
export { findChargeForOrder } from "./payments-status.ts";

export type { AbacateConfig, PaymentStatus, PixListItem, ProviderEnv };
export { AbacateError };

const extraOrigins = Deno.env.get("ALLOWED_ORIGINS") ?? "";

export function responder(req: Request, cors: boolean) {
  const base: Record<string, string> = { "content-type": "application/json", "x-content-type-options": "nosniff", "cache-control": "no-store" };
  const headers = cors ? { ...corsHeaders(req.headers.get("origin"), extraOrigins), ...base } : base;
  return (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin"), extraOrigins) });
}

export function log(fn: string, orderId: string | null, status: string | null, outcome: string): void {
  console.log(JSON.stringify({ fn, orderId, status, outcome }));
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

export function userClient(authHeader: string): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

/** Usuário real (não anônimo) da sessão do chamador. `anonymous` → 403; sem sessão → 401. */
export async function caller(req: Request): Promise<
  { ok: true; client: SupabaseClient; userId: string } | { ok: false; status: 401 | 403 }
> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { ok: false, status: 401 };
  const client = userClient(auth);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401 };
  if (data.user.is_anonymous) return { ok: false, status: 403 };
  return { ok: true, client, userId: data.user.id };
}

/** Configuração do provedor a partir do ambiente. Recusa (null) com ambiente, chave ou URL base inválidos. */
export function providerConfig(): { env: ProviderEnv; config: AbacateConfig } | null {
  const r = resolveAbacateConfig({
    ABACATEPAY_ENV: Deno.env.get("ABACATEPAY_ENV"),
    ABACATEPAY_API_KEY: Deno.env.get("ABACATEPAY_API_KEY"),
    ABACATEPAY_BASE_URL: Deno.env.get("ABACATEPAY_BASE_URL"),
  });
  return r.ok ? { env: r.env, config: { ...r.config, timeoutMs: 8_000 } } : null;
}

/** Regra comum: ABACATEPAY_ENV precisa ser igual a payments_env() (e este não pode ser 'desligado'). */
export async function guardEnv(admin: SupabaseClient): Promise<{ env: ProviderEnv; config: AbacateConfig } | null> {
  const p = providerConfig();
  if (!p) return null;
  const { data, error } = await admin.rpc("payments_env");
  if (error || data !== p.env) return null;
  return p;
}

export type ProviderState = { status: PaymentStatus | null; providerStatus: string; amountCents: number | null; devMode: boolean };

/**
 * Reconsulta a cobrança: `check` dá o status; o valor vem do `check` quando ele informa e, se não, de
 * `GET /transparents/get?id=` (a doc só garante `status` no check). REDEEMED só é `pago` com valor 0 (mapProviderStatus).
 */
export async function recheck(cfg: AbacateConfig, chargeId: string): Promise<ProviderState> {
  const c = await checkPixCharge(cfg, chargeId);
  let amount = c.amount ?? null;
  if (amount === null) {
    amount = (await getPixCharge(cfg, chargeId)).amount ?? null;
  }
  return { status: mapProviderStatus(c.status, amount ?? undefined), providerStatus: c.status, amountCents: amount, devMode: c.devMode };
}

export type OrderRow = {
  id: string;
  event_id: string | null;
  host_id: string;
  plan_code: string;
  amount_cents: number;
  status: PaymentStatus;
  provider_env: ProviderEnv;
  provider_charge_id: string | null;
  created_at: string;
  last_checked_at: string | null;
  refund_requested_at: string | null;
  refund_reason: string | null;
};
export const ORDER_COLUMNS =
  "id,event_id,host_id,plan_code,amount_cents,status,provider_env,provider_charge_id,created_at,last_checked_at,refund_requested_at,refund_reason";

export async function loadOrder(admin: SupabaseClient, id: string): Promise<{ order: OrderRow | null; error: boolean }> {
  const { data, error } = await admin.from("payment_orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
  return { order: (data as OrderRow | null) ?? null, error: !!error };
}

/** Aplica o estado reconsultado. Lança em erro de banco (o chamador decide: 500 no webhook, falha na reconciliação). */
export async function applyStatus(
  admin: SupabaseClient,
  order: OrderRow,
  chargeId: string,
  state: ProviderState,
  devMode: boolean,
  source: "webhook" | "status" | "reconcile",
): Promise<{ applied: boolean; to: string }> {
  if (!state.status) return { applied: false, to: "status_desconhecido" };
  const { data, error } = await admin.rpc("payments_apply_status", {
    p_order: order.id,
    p_charge_id: chargeId,
    p_status: state.status,
    p_amount_cents: state.amountCents,
    p_dev_mode: devMode,
    p_source: source,
  });
  if (error) throw new Error("db");
  const r = (data ?? {}) as { applied?: boolean; to?: string };
  return { applied: r.applied === true, to: String(r.to ?? state.status) };
}

/** Comparação em tempo constante (tokens de mesmo comprimento). */
export function sameToken(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
