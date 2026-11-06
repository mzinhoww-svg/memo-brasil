// Sandbox only. Production credentials are deliberately never read here.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assertChargeOrder, ValidaPayClient } from "./validapay.ts";

let client: ValidaPayClient | null = null;
let refundClient: ValidaPayClient | null = null;
export function validapaySandbox(): ValidaPayClient {
  if (Deno.env.get("VALIDAPAY_SANDBOX_ENABLED") !== "true") throw new Error("disabled");
  if (!client) client = new ValidaPayClient({ environment: "sandbox",
    clientId: Deno.env.get("VALIDAPAY_SANDBOX_CLIENT_ID") ?? "",
    clientSecret: Deno.env.get("VALIDAPAY_SANDBOX_CLIENT_SECRET") ?? "",
  });
  return client;
}
export function validapayRefundSandbox(): ValidaPayClient {
  if (Deno.env.get("VALIDAPAY_SANDBOX_ENABLED") !== "true") throw new Error("disabled");
  if (!refundClient) refundClient = new ValidaPayClient({ environment: "sandbox", mode: "refund",
    clientId: Deno.env.get("VALIDAPAY_SANDBOX_CLIENT_ID") ?? "", clientSecret: Deno.env.get("VALIDAPAY_SANDBOX_CLIENT_SECRET") ?? "" });
  return refundClient;
}
export async function confirmSandboxRefund(admin: SupabaseClient, orderId: string, id: string, source: "status" | "webhook" | "reconcile") {
  const evidence = await validapayRefundSandbox().getRefundEvidence(id, orderId);
  const result = await admin.rpc("payments_validapay_confirm_refund", { p_order: orderId, p_refund: evidence, p_source: source });
  if (result.error) throw new Error("refund_confirmation_failed");
  return evidence;
}
export async function validapayEnabled(admin: SupabaseClient): Promise<boolean> {
  if (Deno.env.get("VALIDAPAY_SANDBOX_ENABLED") !== "true") return false;
  const [env, flag] = await Promise.all([
    admin.rpc("payments_env"), admin.from("feature_flags").select("enabled").eq("key", "validapay_checkout").maybeSingle(),
  ]);
  return !env.error && env.data === "sandbox" && !flag.error && flag.data?.enabled === true;
}
export async function confirmSandboxCharge(admin: SupabaseClient, orderId: string, id: string, source: "status" | "webhook" | "reconcile") {
  const charge = await validapaySandbox().getCharge(id);
  assertChargeOrder(charge, orderId);
  if (charge.status === "REFUNDED") { await confirmSandboxRefund(admin, orderId, id, source); return charge; }
  const result = await admin.rpc("payments_validapay_confirm", { p_order: orderId, p_charge: charge, p_source: source });
  if (result.error) throw new Error("confirmation_failed");
  const metadata: Record<string, string> = {};
  if (charge.emv) metadata.brcode = charge.emv;
  if (charge.expiresAt && Number.isFinite(Date.parse(charge.expiresAt))) metadata.expires_at = charge.expiresAt;
  if (Object.keys(metadata).length) {
    const saved = await admin.from("payment_orders").update(metadata).eq("id", orderId).eq("provider", "validapay").eq("provider_charge_id", id);
    if (saved.error) throw new Error("metadata_save_failed");
  }
  if (source === "reconcile" && charge.status === "PAID") await confirmSandboxRefund(admin, orderId, id, source);
  return charge;
}
