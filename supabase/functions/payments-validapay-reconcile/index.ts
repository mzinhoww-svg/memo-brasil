import { log, responder, sameToken, serviceClient } from "../_shared/payments-runtime.ts";
import { confirmSandboxCharge, confirmSandboxRefund, pixExpiryMinutes, validapayClient, validapayEnvironment, validapayRuntimeEnabled, validapaySecret } from "../_shared/validapay-runtime.ts";
import { pixExpired, ValidaPayError } from "../_shared/validapay.ts";

/** Falha por pedido para a folha "Conciliar agora": "#RV-XXXX · título do evento" e uma frase curta. Nunca devolve a mensagem crua do provedor. */
async function describeFailure(admin: ReturnType<typeof serviceClient>, orderId: string, e: unknown): Promise<{ orderId: string; label: string; message: string }> {
  const order = await admin.from("payment_orders").select("event_id").eq("id", orderId).maybeSingle();
  const event = order.data?.event_id ? await admin.from("events").select("title").eq("id", order.data.event_id).maybeSingle() : null;
  const code = `#${orderId.slice(0, 8).toUpperCase()}`;
  const message = e instanceof ValidaPayError ? `O provedor respondeu com erro (${e.status}). A rotina tenta de novo.`
    : e instanceof Error && e.message === "confirmation_failed" ? "O provedor respondeu, mas a confirmação não foi gravada. A rotina tenta de novo."
    : "Não foi possível confirmar agora. A rotina tenta de novo.";
  return { orderId, label: event?.data?.title ? `${code} · ${event.data.title}` : code, message };
}

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
  const orders = await admin.from("payment_orders").select("id,provider_charge_id,status,payment_method,created_at").eq("provider", "validapay").eq("provider_env", environment)
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
  // Pix pendente além da validade configurada pelo Master: o reconciliador encerra sozinho (cancela no provedor), sem esperar o checkout consultar.
  const minutes = await pixExpiryMinutes(admin);
  const lapsed = new Set((orders.data ?? []).filter((o) => o.payment_method === "pix" && o.status === "pendente" && pixExpired(o.created_at, minutes, Date.now())).map((o) => o.provider_charge_id));
  for (const e of pendingEvents) {
    if (candidates.has(e.charge_id)) continue;
    const lookup = await admin.from("payment_orders").select("id").eq("provider", "validapay").eq("provider_env", environment).eq("provider_charge_id", e.charge_id).maybeSingle();
    if (!lookup.error && lookup.data) candidates.set(e.charge_id, lookup.data.id);
  }
  // confirmed = o pedido mudou de situação; unchanged = o provedor confirmou o que já estava gravado; failures = o que falhou, por pedido (sem dado pessoal)
  let confirmed = 0, failed = 0, unchanged = 0;
  const failures: { orderId: string; label: string; message: string }[] = [];
  for (const [id, orderId] of candidates) {
    let before: string | null = null;
    try {
      before = (await admin.from("payment_orders").select("status").eq("id", orderId).maybeSingle()).data?.status ?? null;
      // Advance the scan even if a poison order repeatedly fails confirmation.
      const touched = await admin.from("payment_orders").update({ last_checked_at: new Date().toISOString() }).eq("id", orderId).eq("provider", "validapay");
      if (touched.error) throw new Error("touch_failed");
      if (lapsed.has(id) && !refundCharges.has(id)) {
        try { await validapayClient(environment!).cancelCharge(id, orderId); }
        catch (e) { if (!(e instanceof ValidaPayError) || e.status !== 400) throw e; }
      }
      if (refundCharges.has(id)) await confirmSandboxRefund(admin, orderId, id, "reconcile");
      else await confirmSandboxCharge(admin, orderId, id, "reconcile");
      const mark = await admin.from("validapay_webhook_inbox").update({ processed_at: new Date().toISOString(), outcome: "confirmed" }).eq("provider_env", environment).eq("charge_id", id).is("processed_at", null);
      if (mark.error) throw new Error("mark_failed");
      const after = (await admin.from("payment_orders").select("status").eq("id", orderId).maybeSingle()).data?.status ?? null;
      if (after !== before) confirmed++; else unchanged++;
    } catch (e) {
      failed++;
      log("payments-validapay-reconcile", orderId, null, "pending_reconciliation");
      if (failures.length < 20) failures.push(await describeFailure(admin, orderId, e));
    }
  }
  return json({ confirmed, failed, unchanged, failures, unattached: pendingEvents.filter((e) => !candidates.has(e.charge_id)).length });
});
