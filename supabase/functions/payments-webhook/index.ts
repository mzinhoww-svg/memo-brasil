// Webhook do Mercado Pago (verify_jwt=false). Autentica SOMENTE por x-signature (HMAC-SHA256 do manifest
// `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com MERCADOPAGO_WEBHOOK_SECRET, tolerância de ts, tempo constante).
// Não existe mais ?webhookSecret=. Assinatura inválida → 401 sem tocar no banco. Depois de válida, o corpo só dispara a
// reconsulta: o estado é sempre o de GET /v1/payments/{id}, aplicado pelo banco (payments_apply_payment).
// Respostas: 200 {ok:true} (duplicado, ignorado, tópico desconhecido, pedido desconhecido); 401 sem assinatura válida;
// 500 só quando banco/provedor falham, para o Mercado Pago reenviar (responder em até ~22 s).
import { getPayment, MercadoPagoError } from "../_shared/mercadopago.ts";
import { notificationEventKey, parseNotification } from "../_shared/mercadopago-flow.ts";
import { verifyMercadoPagoSignature } from "../_shared/mercadopago-signature.ts";
import { applyPayment, expectedCollector, loadOrder, log, mpConfig, responder, serviceClient, UUID_RE } from "../_shared/payments-runtime.ts";

const FN = "payments-webhook";

Deno.serve(async (req) => {
  const json = responder(req, false);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const rawBody = await req.text();
  const note = parseNotification(rawBody, req.url);
  let queryDataId: string | null = null;
  try { queryDataId = new URL(req.url).searchParams.get("data.id"); } catch { /* url inválida */ }
  const sig = await verifyMercadoPagoSignature({
    secret: Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") ?? "",
    signatureHeader: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId: queryDataId,
    nowMs: Date.now(),
  });
  if (!sig.ok) {
    log(FN, null, null, `nao_autenticado_${sig.reason}`);
    return json({ error: "unauthorized" }, 401);
  }

  if (note.type !== "payment" || !note.dataId) {
    log(FN, null, null, "topico_ignorado"); // chargebacks/merchant_order/etc.: sem efeito nesta fase (design §6, item 8)
    return json({ ok: true });
  }
  const cfg = mpConfig();
  if (!cfg) {
    log(FN, null, null, "pagamento_indisponivel");
    return json({ error: "pagamento_indisponivel" }, 503);
  }

  const admin = serviceClient();
  const eventKey = notificationEventKey(note, req.headers.get("x-request-id"));
  const rec = await admin.rpc("payments_record_event", {
    p_provider: "mercadopago", p_provider_event_id: eventKey, p_type: `${note.type}${note.action ? `:${note.action}` : ""}`,
    p_order: null, p_outcome: "recebido", p_detail: { type: note.type, action: note.action, dataId: note.dataId, liveMode: note.liveMode },
  });
  if (rec.error) {
    log(FN, null, null, "erro_banco");
    return json({ error: "db" }, 500);
  }
  if (rec.data === false) {
    // entrega repetida: só reprocessa se a anterior não terminou (ficou 'recebido' porque o banco/provedor falhou)
    const prev = await admin.from("payment_events").select("outcome").eq("provider", "mercadopago").eq("provider_event_id", eventKey).maybeSingle();
    if (prev.error) return json({ error: "db" }, 500);
    if (prev.data?.outcome !== "recebido") {
      log(FN, null, null, "duplicado");
      return json({ ok: true });
    }
  }
  const finish = async (orderId: string | null, status: string | null, outcome: string) => {
    const u = await admin.from("payment_events").update({ outcome, order_id: orderId }).eq("provider", "mercadopago").eq("provider_event_id", eventKey);
    if (u.error) log(FN, orderId, status, "falha_ao_gravar_resultado");
    log(FN, orderId, status, outcome);
    return json({ ok: true });
  };

  try {
    const payment = await getPayment(cfg, note.dataId);
    const ref = payment.externalReference;
    if (!ref || !UUID_RE.test(ref)) return finish(null, null, "pedido_desconhecido");
    const { order, error } = await loadOrder(admin, ref);
    if (error) {
      log(FN, ref, null, "erro_banco");
      return json({ error: "db" }, 500);
    }
    if (!order || order.provider !== "mercadopago") return finish(null, null, "pedido_desconhecido");
    const collector = await expectedCollector(cfg);
    const r = await applyPayment(admin, order.id, payment, collector, "webhook");
    return finish(order.id, r.to || order.status, r.outcome);
  } catch (e) {
    if (e instanceof MercadoPagoError && e.kind === "invalid" && e.status === 404) return finish(null, null, "pagamento_inexistente");
    log(FN, null, null, e instanceof MercadoPagoError ? `provedor_${e.kind}` : "erro_banco");
    return json({ error: "provider" }, 500); // nada é aplicado sem a reconsulta; o provedor reenvia
  }
});
