import { responder, serviceClient, log } from "../_shared/payments-runtime.ts";
import { verifyValidaPaySignature } from "../_shared/validapay-signature.ts";
import { confirmSandboxCharge, confirmSandboxRefund, validapayEnvironment, validapayRuntimeEnabled, validapaySecret } from "../_shared/validapay-runtime.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
Deno.serve(async (req) => {
  const json = responder(req, false);
  const environment = validapayEnvironment();
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!validapayRuntimeEnabled(environment)) return json({ error: "disabled" }, 503);
  const raw = await req.text();
  if (raw.length > 65_536) return json({ error: "invalid" }, 413);
  if (!await verifyValidaPaySignature(raw, req.headers.get("X-Webhook-Signature"), validapaySecret("WEBHOOK_SECRET"))) return json({ error: "unauthorized" }, 401);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: "invalid" }, 400); }
  const id = req.headers.get("X-Webhook-Id");
  if (!b || typeof b !== "object" || !id || id.length > 200 || typeof b.chargeId !== "string" || !/^(SANDBOX_)?cha_[A-Za-z0-9_-]{1,150}$/.test(b.chargeId) || typeof b.event !== "string" || b.event.length > 100) return json({ error: "invalid" }, 400);
  if (environment === "production" && b.chargeId.startsWith("SANDBOX_")) return json({ error: "invalid" }, 400);
  const admin = serviceClient();
  const eventType = b.event;
  // Store only identifiers, never buyer data or raw payload. Persistence precedes ACK.
  const insert = await admin.from("validapay_webhook_inbox").upsert({ provider_env: environment, event_id: id, charge_id: b.chargeId, event_type: b.event }, { onConflict: "provider_env,event_id", ignoreDuplicates: true });
  if (insert.error) return json({ error: "indisponivel" }, 503);
  const process = async () => {
    try {
      const pending = await admin.from("validapay_webhook_inbox").select("charge_id,processed_at").eq("provider_env", environment).eq("event_id", id).single();
      if (pending.error || pending.data.processed_at) return;
      const order = await admin.from("payment_orders").select("id").eq("provider", "validapay").eq("provider_env", environment).eq("provider_charge_id", pending.data.charge_id).maybeSingle();
      if (order.error || !order.data) throw new Error("order_not_attached_yet");
      if (eventType.startsWith("refund.")) await confirmSandboxRefund(admin, order.data.id, pending.data.charge_id, "webhook");
      else await confirmSandboxCharge(admin, order.data.id, pending.data.charge_id, "webhook");
      await admin.from("validapay_webhook_inbox").update({ processed_at: new Date().toISOString(), outcome: "confirmed" }).eq("provider_env", environment).eq("event_id", id);
    } catch { log("payments-validapay-webhook", null, null, "pending_reconciliation"); }
  };
  EdgeRuntime.waitUntil(process());
  return json({ received: true });
});
