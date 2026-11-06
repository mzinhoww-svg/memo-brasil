import { log, responder, sameToken, serviceClient } from "../_shared/payments-runtime.ts";
import { confirmSandboxCharge, confirmSandboxRefund, validapayEnvironment, validapayRuntimeEnabled, validapaySecret } from "../_shared/validapay-runtime.ts";

Deno.serve(async (req) => {
  const json = responder(req, false);
  const environment = validapayEnvironment();
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const expected = validapaySecret("RECONCILE_TOKEN");
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!sameToken(expected, provided)) return json({ error: "unauthorized" }, 401);
  if (!validapayRuntimeEnabled(environment)) return json({ error: "disabled" }, 503);
  const admin = serviceClient();
  const pending = await admin.rpc("payments_validapay_claim_inbox_env", { p_environment: environment, p_limit: 50 });
  const pendingEvents = (pending.data ?? []) as { event_id: string; charge_id: string; attempts: number; event_type: string }[];
  const refundRequests = await admin.from("validapay_refund_requests").select("order_id").neq("state", "confirmed").order("checked_at", { nullsFirst: true }).limit(50);
  const orders = await admin.from("payment_orders").select("id,provider_charge_id").eq("provider", "validapay").eq("provider_env", environment)
    .in("status", ["criado", "pendente", "expirado", "falhou", "pago", "em_disputa"]).not("provider_charge_id", "is", null).order("last_checked_at", { nullsFirst: true }).limit(50);
  if (pending.error || orders.error || refundRequests.error) return json({ error: "indisponivel" }, 503);
  const candidates = new Map<string, string>();
  const refundCharges = new Set(pendingEvents.filter((e) => e.event_type.startsWith("refund.")).map((e) => e.charge_id));
  for (const request of refundRequests.data ?? []) {
    const lookup = await admin.from("payment_orders").select("id,provider_charge_id").eq("id", request.order_id).eq("provider", "validapay").eq("provider_env", environment).maybeSingle();
    if (!lookup.error && lookup.data?.provider_charge_id) { candidates.set(lookup.data.provider_charge_id, lookup.data.id); refundCharges.add(lookup.data.provider_charge_id); }
    await admin.from("validapay_refund_requests").update({ checked_at: new Date().toISOString() }).eq("order_id", request.order_id);
  }
  for (const o of orders.data ?? []) candidates.set(o.provider_charge_id, o.id);
  for (const e of pendingEvents) {
    if (candidates.has(e.charge_id)) continue;
    const lookup = await admin.from("payment_orders").select("id").eq("provider", "validapay").eq("provider_env", environment).eq("provider_charge_id", e.charge_id).maybeSingle();
    if (!lookup.error && lookup.data) candidates.set(e.charge_id, lookup.data.id);
  }
  let confirmed = 0, failed = 0;
  for (const [id, orderId] of candidates) {
    try {
      // Advance the scan even if a poison order repeatedly fails confirmation.
      const touched = await admin.from("payment_orders").update({ last_checked_at: new Date().toISOString() }).eq("id", orderId).eq("provider", "validapay");
      if (touched.error) throw new Error("touch_failed");
      if (refundCharges.has(id)) await confirmSandboxRefund(admin, orderId, id, "reconcile");
      else await confirmSandboxCharge(admin, orderId, id, "reconcile");
      const mark = await admin.from("validapay_webhook_inbox").update({ processed_at: new Date().toISOString(), outcome: "confirmed" }).eq("provider_env", environment).eq("charge_id", id).is("processed_at", null);
      if (mark.error) throw new Error("mark_failed");
      confirmed++;
    } catch {
      failed++;
      log("payments-validapay-reconcile", orderId, null, "pending_reconciliation");
    }
  }
  return json({ confirmed, failed, unattached: pendingEvents.filter((e) => !candidates.has(e.charge_id)).length });
});
