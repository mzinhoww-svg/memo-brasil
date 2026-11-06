import { caller, log, preflight, responder, serviceClient, UUID_RE } from "../_shared/payments-runtime.ts";
import { confirmSandboxRefund, validapayRefundSandbox } from "../_shared/validapay-runtime.ts";

Deno.serve(async (req) => {
  const json = responder(req, true);
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const who = await caller(req);
  if (!who.ok) return json({ error: "unauthorized" }, who.status);
  const master = await who.client.rpc("is_master");
  if (master.error || master.data !== true) return json({ error: "forbidden" }, 403);
  if (Deno.env.get("VALIDAPAY_SANDBOX_ENABLED") !== "true") return json({ error: "disabled" }, 503);
  const admin = serviceClient();
  let orderId: string | null = null;
  try {
    const raw = await req.text();
    if (raw.length > 2048) return json({ error: "invalid" }, 400);
    const b = JSON.parse(raw);
    if (!b || typeof b !== "object" || !UUID_RE.test(b.orderId ?? "") || !UUID_RE.test(b.requestId ?? "") || b.confirm !== "sandbox-full-refund") return json({ error: "invalid" }, 400);
    orderId = b.orderId;
    const order = await admin.from("payment_orders").select("id,provider_charge_id").eq("id", orderId).eq("provider", "validapay").eq("provider_env", "sandbox").maybeSingle();
    if (order.error || !order.data?.provider_charge_id) return json({ error: "nao_encontrado" }, 404);
    // Reserve in PostgreSQL BEFORE POST. An uncertain POST is never retried automatically.
    const claim = await admin.rpc("payments_validapay_claim_refund", { p_order: orderId, p_request: b.requestId });
    if (claim.error) return json({ error: "estado_invalido" }, 422);
    if (claim.data?.claimed === true) {
      const reserved = await admin.from("validapay_refund_requests").update({ state: "uncertain", requested_by: who.userId }).eq("order_id", orderId);
      if (reserved.error) throw new Error("refund_reservation_failed");
      const sent = await validapayRefundSandbox().requestRefund(order.data.provider_charge_id, orderId!, claim.data.amountCents);
      const saved = await admin.from("validapay_refund_requests").update({ state: "processing", refund_id: sent.refundId }).eq("order_id", orderId);
      if (saved.error) throw new Error("refund_save_failed");
    }
    const evidence = await confirmSandboxRefund(admin, orderId!, order.data.provider_charge_id, "status");
    return json({ orderId, refundedCents: evidence.refundedCents, confirmed: evidence.refundedCents === evidence.amountCents });
  } catch {
    log("payments-validapay-refund", orderId, null, "pending_manual_review_or_reconciliation");
    return json({ error: "estorno_em_verificacao", orderId }, 502);
  }
});
