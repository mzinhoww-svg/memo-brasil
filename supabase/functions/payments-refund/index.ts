// Reembolso disparado pelo Master (verify_jwt=true; o chamador precisa de is_master()). Só para pedido com
// refund_requested_at (gravado por admin_request_refund, Task 7). Chama o provedor e NÃO muda o estado: o 'estornado'
// chega pelo webhook transparent.refunded ou pela reconciliação. Idempotente: pedido já estornado não chama o provedor,
// e "já reembolsada" do provedor conta como sucesso (refundCharge).
import { refundCharge } from "../_shared/abacatepay.ts";
import { AbacateError, caller, guardEnv, loadOrder, log, preflight, responder, serviceClient, UUID_RE } from "../_shared/payments-runtime.ts";

const FN = "payments-refund";

Deno.serve(async (req) => {
  const json = responder(req, true);
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const who = await caller(req);
  if (!who.ok) return json({ error: who.status === 401 ? "unauthorized" : "forbidden" }, who.status);
  const m = await who.client.rpc("is_master");
  if (m.error || m.data !== true) return json({ error: "forbidden" }, 403);

  let orderId = "";
  try {
    orderId = String(((await req.json()) as Record<string, unknown>).orderId ?? "");
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (!UUID_RE.test(orderId)) return json({ error: "invalid" }, 400);

  const admin = serviceClient();
  const provider = await guardEnv(admin);
  if (!provider) return json({ error: "pagamento_indisponivel" }, 503);

  const { order, error } = await loadOrder(admin, orderId);
  if (error) return json({ error: "indisponivel" }, 500);
  if (!order) return json({ error: "nao_encontrado" }, 404);
  if (order.status === "estornado") {
    log(FN, order.id, order.status, "ja_estornado");
    return json({ ok: true });
  }
  if (!order.refund_requested_at) return json({ error: "reembolso_nao_solicitado" }, 422);
  if (!order.provider_charge_id || (order.status !== "pago" && order.status !== "em_disputa")) return json({ error: "estado_invalido" }, 422);
  if (order.provider_env !== provider.env) return json({ error: "pagamento_indisponivel" }, 503);

  try {
    await refundCharge(provider.config, order.provider_charge_id, order.refund_reason ?? "Reembolso solicitado pelo MemoriesMT");
  } catch (e) {
    log(FN, order.id, order.status, e instanceof AbacateError ? `provedor_${e.kind}` : "provedor_erro");
    return json({ error: "provedor_indisponivel", orderId: order.id }, 502);
  }
  log(FN, order.id, order.status, "reembolso_solicitado");
  return json({ ok: true });
});
