// Reembolso disparado pelo Master (verify_jwt=true; o chamador precisa de is_master()). Só para pedido com solicitação gravada
// por admin_request_refund / admin_request_payment_refund. O BANCO decide o alvo (payments_refund_target): o pagamento vinculado
// de pedido pago, ou uma cobrança extra pedida explicitamente por `paymentId` — nunca uma cobrança divergente por inferência
// (PAY-001). Reconsulta o pagamento (aprovado, do pedido, recebedor e ambiente) antes de POST /v1/payments/{id}/refunds com
// X-Idempotency-Key estável por solicitação (repetir a chamada não reembolsa duas vezes). Total (sem valor) ou parcial
// (refund_amount_cents). Roda para pedidos de qualquer ambiente mesmo com payments_env='desligado': desligar a cobrança não
// pode prender dinheiro recebido. Pix pode voltar `in_process`: o pedido segue 'pago' até 'refunded' chegar por webhook ou
// conciliação. Pedidos históricos da AbacatePay não são reembolsados aqui (provedor_historico).
import { getPayment, MercadoPagoError, refundIdempotencyKey, refundPayment } from "../_shared/mercadopago.ts";
import { refundBlocker } from "../_shared/mercadopago-flow.ts";
import { applyPayment, caller, expectedCollector, loadOrder, log, mpConfig, preflight, responder, serviceClient, UUID_RE, withEffectiveLiveMode } from "../_shared/payments-runtime.ts";

const FN = "payments-refund";

Deno.serve(async (req) => {
  const json = responder(req, true);
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const who = await caller(req);
  if (!who.ok) return json({ error: who.status === 401 ? "unauthorized" : "forbidden" }, who.status);
  const m = await who.client.rpc("is_master");
  if (m.error || m.data !== true) return json({ error: "forbidden" }, 403);

  let orderId = "", paymentId: string | null = null;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    orderId = String(b.orderId ?? "");
    paymentId = b.paymentId === undefined || b.paymentId === null ? null : String(b.paymentId);
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (!UUID_RE.test(orderId) || (paymentId !== null && !/^[0-9A-Za-z_-]{1,40}$/.test(paymentId))) return json({ error: "invalid" }, 400);

  const admin = serviceClient();
  const { order, error } = await loadOrder(admin, orderId);
  if (error) return json({ error: "indisponivel" }, 500);
  if (!order) return json({ error: "nao_encontrado" }, 404);
  if (order.provider !== "mercadopago") return json({ error: "provedor_historico" }, 422);
  const cfg = mpConfig(order.provider_env); // credenciais do ambiente DO PEDIDO
  if (!cfg) return json({ error: "pagamento_indisponivel" }, 503);
  if (order.status === "estornado" && paymentId === null) {
    log(FN, order.id, order.status, "ja_estornado");
    return json({ ok: true });
  }

  const t = await admin.rpc("payments_refund_target", { p_order: order.id, p_payment: paymentId });
  const target = Array.isArray(t.data) ? (t.data[0] as { payment_id: string; kind: "primary" | "extra" } | undefined) : undefined;
  if (t.error || !target) return json({ error: "estado_invalido" }, 422);

  let requestedAt: string | null = order.refund_requested_at, amount: number | null = order.refund_amount_cents;
  if (target.kind === "extra") {
    const c = await admin.from("payment_charges").select("refund_requested_at,refund_amount_cents")
      .eq("provider", "mercadopago").eq("payment_id", target.payment_id).maybeSingle();
    requestedAt = (c.data?.refund_requested_at as string | null) ?? null;
    amount = (c.data?.refund_amount_cents as number | null) ?? null;
  }
  const pre = refundBlocker(order, { kind: target.kind, requestedAt });
  if (pre) return json({ error: pre }, 422);

  try {
    const collector = await expectedCollector(cfg);
    const payment = await getPayment(cfg, target.payment_id);
    const mismatch = refundBlocker(order, { kind: target.kind, requestedAt }, withEffectiveLiveMode(payment), collector);
    if (mismatch) {
      log(FN, order.id, order.status, mismatch);
      return json({ error: mismatch }, 422);
    }
    const key = await refundIdempotencyKey(order.id, target.payment_id, requestedAt!, amount);
    const r = await refundPayment(cfg, target.payment_id, { idempotencyKey: key, amountCents: amount });
    log(FN, order.id, order.status, `reembolso_${r.status}`);
    // melhor esforço: se o reembolso já foi aprovado, o pagamento volta 'refunded' e o banco fecha o pedido agora
    try {
      const after = await getPayment(cfg, target.payment_id);
      await applyPayment(admin, order.id, after, collector, "status");
    } catch { /* o webhook/conciliação aplicam depois */ }
    return json({ ok: true, status: r.status, paymentId: target.payment_id });
  } catch (e) {
    if (e instanceof MercadoPagoError && e.kind === "invalid" && e.providerCode) {
      log(FN, order.id, order.status, `provedor_${e.providerCode}`);
      return json({ error: "reembolso_recusado", code: e.providerCode }, 422);
    }
    log(FN, order.id, order.status, e instanceof MercadoPagoError ? `provedor_${e.kind}` : "provedor_erro");
    return json({ error: "provedor_indisponivel", orderId: order.id }, 502);
  }
});
