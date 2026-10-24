// Peças comuns das Edge Functions de pagamento (só Deno: lê Deno.env e cria clientes Supabase). Provedor ativo: Mercado Pago.
// Nunca registra token, corpo bruto nem dados do pagador: o log é só {fn, orderId, status, outcome}.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";
import { getMe, MercadoPagoError, type MercadoPagoConfig, type MpPayment } from "./mercadopago.ts";
import { resolveMercadoPagoConfig } from "./mercadopago-config.ts";
import { effectiveLiveMode } from "./mercadopago-flow.ts";

export { MercadoPagoError };
export type { MercadoPagoConfig, MpPayment };
export type ProviderEnv = "sandbox" | "production";

const extraOrigins = Deno.env.get("ALLOWED_ORIGINS") ?? "";
export const allowedOrigins = () => extraOrigins;

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

/** Configuração do Mercado Pago a partir do ambiente. Recusa (null) com token ausente ou URL base inválida. */
export function mpConfig(env?: ProviderEnv | null): MercadoPagoConfig | null {
  const r = resolveMercadoPagoConfig({
    MERCADOPAGO_ACCESS_TOKEN: Deno.env.get("MERCADOPAGO_ACCESS_TOKEN"),
    MERCADOPAGO_ACCESS_TOKEN_SANDBOX: Deno.env.get("MERCADOPAGO_ACCESS_TOKEN_SANDBOX"),
    MERCADOPAGO_BASE_URL: Deno.env.get("MERCADOPAGO_BASE_URL"),
  }, env);
  return r.ok ? { ...r.config, timeoutMs: 8_000 } : null;
}

/** Checkout/status: o interruptor payments_env() não pode estar 'desligado'. O ambiente do PAGAMENTO vem de live_mode. */
export async function guardEnv(admin: SupabaseClient): Promise<{ env: ProviderEnv; config: MercadoPagoConfig } | null> {
  const { data, error } = await admin.rpc("payments_env");
  if (error || (data !== "sandbox" && data !== "production")) return null;
  const config = mpConfig(data);
  if (!config) return null;
  return { env: data, config };
}

const collectorCache = new Map<string, { id: string; at: number }>(); // por token: sandbox e produção têm recebedores distintos
/** recebedor (id) -> é conta de teste? Preenchido por expectedCollector; null = a API não informou. */
const testCollectors = new Map<string, boolean | null>();
export const collectorIsTestUser = (id: string | null | undefined): boolean | null => (id && testCollectors.has(id) ? testCollectors.get(id)! : null);
/** Pagamento com o live_mode efetivo (ver effectiveLiveMode): usar antes de decidir o ambiente. */
export const withEffectiveLiveMode = (p: MpPayment): MpPayment => ({ ...p, liveMode: effectiveLiveMode(p.liveMode, collectorIsTestUser(p.collectorId)) });
/** Conta recebedora esperada: GET /users/me (nunca parâmetro de entrada). Cache de 5 min. Lança MercadoPagoError. */
export async function expectedCollector(cfg: MercadoPagoConfig): Promise<string> {
  const hit = collectorCache.get(cfg.accessToken);
  if (hit && Date.now() - hit.at < 300_000) return hit.id;
  const me = await getMe(cfg);
  collectorCache.set(cfg.accessToken, { id: me.id, at: Date.now() });
  testCollectors.set(me.id, me.testUser);
  return me.id;
}

export type OrderRow = {
  id: string;
  event_id: string | null;
  host_id: string;
  plan_code: string;
  amount_cents: number;
  status: string;
  provider: string;
  provider_env: ProviderEnv;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  checkout_url: string | null;
  created_at: string;
  last_checked_at: string | null;
  refund_requested_at: string | null;
  refund_reason: string | null;
  refund_amount_cents: number | null;
  needs_refund: boolean;
};
export const ORDER_COLUMNS =
  "id,event_id,host_id,plan_code,amount_cents,status,provider,provider_env,mp_preference_id,mp_payment_id,checkout_url,created_at,last_checked_at,refund_requested_at,refund_reason,refund_amount_cents,needs_refund";

export async function loadOrder(admin: SupabaseClient, id: string): Promise<{ order: OrderRow | null; error: boolean }> {
  const { data, error } = await admin.from("payment_orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
  return { order: (data as OrderRow | null) ?? null, error: !!error };
}

/** Aplica o pagamento reconsultado (a decisão financeira é toda do banco). Lança em erro de banco. */
export async function applyPayment(
  admin: SupabaseClient, orderId: string, payment: MpPayment, collector: string, source: "webhook" | "status" | "reconcile",
): Promise<{ applied: boolean; outcome: string; to: string }> {
  const { data, error } = await admin.rpc("payments_apply_payment", {
    p_order: orderId, p_payment: withEffectiveLiveMode(payment), p_expected_collector: collector, p_source: source,
  });
  if (error) throw new Error("db");
  const r = (data ?? {}) as { applied?: boolean; outcome?: string; to?: string };
  return { applied: r.applied === true, outcome: String(r.outcome ?? "desconhecido"), to: String(r.to ?? "") };
}

/** Comparação em tempo constante (tokens de mesmo comprimento). */
export function sameToken(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
