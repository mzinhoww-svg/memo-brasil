import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assertChargeOrder, capPixExpiry, normalizePixExpiry, resolveValidaPayEnvironment, ValidaPayClient, type ProviderEnvironment } from "./validapay.ts";

/** Trusted deployment selection only. An unset selector preserves explicitly enabled sandbox installations. */
export function validapayEnvironment(): ProviderEnvironment | null {
  return resolveValidaPayEnvironment((name) => Deno.env.get(name));
}
export function validapayRuntimeEnabled(environment = validapayEnvironment()): environment is ProviderEnvironment {
  return environment !== null && Deno.env.get(environment === "production" ? "VALIDAPAY_PRODUCTION_ENABLED" : "VALIDAPAY_SANDBOX_ENABLED") === "true";
}
export function validapaySecret(kind: "WEBHOOK_SECRET" | "RECONCILE_TOKEN"): string {
  const env = validapayEnvironment();
  return env && validapayRuntimeEnabled(env) ? Deno.env.get(`VALIDAPAY_${env.toUpperCase()}_${kind}`) ?? "" : "";
}
const clients = new Map<string, ValidaPayClient>();
export function validapayClient(environment: ProviderEnvironment, mode: "checkout" | "refund-read" | "refund" = "checkout"): ValidaPayClient {
  if (!validapayRuntimeEnabled(environment) || (mode === "refund" && environment !== "sandbox")) throw new Error("disabled");
  const key = `${environment}:${mode}`;
  let client = clients.get(key);
  if (!client) {
    client = new ValidaPayClient({ environment, mode,
      clientId: Deno.env.get(environment === "production" ? "CLIENTID_VALIDAPAY" : "VALIDAPAY_SANDBOX_CLIENT_ID") ?? "",
      clientSecret: Deno.env.get(environment === "production" ? "CLIENTSECRET_VALIDAPAY" : "VALIDAPAY_SANDBOX_CLIENT_SECRET") ?? "" });
    clients.set(key, client);
  }
  return client;
}
export function validapaySandbox() { return validapayClient("sandbox"); }
export function validapayRefundSandbox() { return validapayClient("sandbox", "refund"); }
async function orderEnvironment(admin: SupabaseClient, orderId: string): Promise<ProviderEnvironment> {
  const read = await admin.from("payment_orders").select("provider_env").eq("id", orderId).eq("provider", "validapay").single();
  if (read.error || !["production", "sandbox"].includes(read.data?.provider_env)) throw new Error("invalid_order_environment");
  return read.data.provider_env;
}
export async function validapayEnabled(admin: SupabaseClient): Promise<boolean> {
  const environment = validapayEnvironment();
  if (!validapayRuntimeEnabled(environment)) return false;
  const [env, flag] = await Promise.all([admin.rpc("payments_env"), admin.from("feature_flags").select("enabled").eq("key", "validapay_checkout").maybeSingle()]);
  return !env.error && env.data === environment && !flag.error && flag.data?.enabled === true;
}
/** Cartão no checkout: só com a chave `validapay_card` ligada pelo Master (feature_flags). Sem linha = desligada. */
export async function validapayCardEnabled(admin: SupabaseClient): Promise<boolean> {
  const flag = await admin.from("feature_flags").select("enabled").eq("key", "validapay_card").maybeSingle();
  return !flag.error && flag.data?.enabled === true;
}
/** Minutos de validade do Pix (Master, platform_settings); padrão 15. */
export async function pixExpiryMinutes(admin: SupabaseClient): Promise<number> {
  const row = await admin.from("platform_settings").select("value").eq("key", "validapay_pix_expiry_minutes").maybeSingle();
  return normalizePixExpiry(row.error ? null : row.data?.value);
}
export async function confirmSandboxRefund(admin: SupabaseClient, orderId: string, id: string, source: "status" | "webhook" | "reconcile") {
  const environment = await orderEnvironment(admin, orderId);
  const evidence = await validapayClient(environment, "refund-read").getRefundEvidence(id, orderId);
  const result = await admin.rpc("payments_validapay_confirm_refund", { p_order: orderId, p_refund: evidence, p_source: source });
  if (result.error) throw new Error("refund_confirmation_failed");
  return evidence;
}
export async function confirmSandboxCharge(admin: SupabaseClient, orderId: string, id: string, source: "status" | "webhook" | "reconcile") {
  const charge = await validapayClient(await orderEnvironment(admin, orderId)).getCharge(id);
  assertChargeOrder(charge, orderId);
  if (charge.status === "REFUNDED") { await confirmSandboxRefund(admin, orderId, id, source); return charge; }
  const result = await admin.rpc("payments_validapay_confirm", { p_order: orderId, p_charge: charge, p_source: source });
  if (result.error) throw new Error("confirmation_failed");
  const metadata: Record<string, string> = {};
  if (charge.emv) metadata.brcode = charge.emv;
  if (charge.method === "pix") {
    // o Master pode encurtar a validade do Pix: vale o menor prazo entre o do provedor e o configurado
    const created = await admin.from("payment_orders").select("created_at").eq("id", orderId).maybeSingle();
    const capped = created.data?.created_at ? capPixExpiry(charge.expiresAt, created.data.created_at, await pixExpiryMinutes(admin)) : charge.expiresAt;
    if (capped && Number.isFinite(Date.parse(capped))) metadata.expires_at = capped;
  } else if (charge.expiresAt && Number.isFinite(Date.parse(charge.expiresAt))) metadata.expires_at = charge.expiresAt;
  if (Object.keys(metadata).length) {
    const saved = await admin.from("payment_orders").update(metadata).eq("id", orderId).eq("provider", "validapay").eq("provider_charge_id", id);
    if (saved.error) throw new Error("metadata_save_failed");
  }
  if (source === "reconcile" && charge.status === "PAID") await confirmSandboxRefund(admin, orderId, id, source);
  return charge;
}
