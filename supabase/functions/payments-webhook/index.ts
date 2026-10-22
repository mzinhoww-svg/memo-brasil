// Webhook da AbacatePay (verify_jwt=false). Autentica com ?webhookSecret + X-Webhook-Signature (HMAC do corpo bruto),
// deduplica pelo id da entrega e aplica SEMPRE o status reconsultado no provedor: o tipo do evento só dispara a reconsulta.
// Respostas: 200 {ok:true} (inclusive duplicado, ignorado ou pedido desconhecido); 401 sem autenticação válida;
// 500 só quando o banco (ou a reconsulta) falha, para o provedor tentar de novo.
import { getPixCharge } from "../_shared/abacatepay.ts";
import { chargeMatchesOrder } from "../_shared/payments-status.ts";
import { verifyWebhookRequest } from "../_shared/payments-webhook-auth.ts";
import { applyStatus, loadOrder, log, providerConfig, recheck, responder, serviceClient, UUID_RE } from "../_shared/payments-runtime.ts";

const FN = "payments-webhook";

type Envelope = { id?: unknown; event?: unknown; devMode?: unknown; data?: { transparent?: Record<string, unknown> | null } | null };

Deno.serve(async (req) => {
  const json = responder(req, false);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const rawBody = await req.text(); // corpo bruto ANTES de qualquer parse: é ele que é assinado
  const authed = await verifyWebhookRequest({
    url: req.url,
    rawBody,
    signatureHeader: req.headers.get("x-webhook-signature"),
    expectedSecret: Deno.env.get("ABACATEPAY_WEBHOOK_SECRET") ?? "",
    hmacKey: Deno.env.get("ABACATEPAY_HMAC_KEY") ?? "",
  });
  if (!authed) {
    log(FN, null, null, "nao_autenticado");
    return json({ error: "unauthorized" }, 401);
  }

  const provider = providerConfig();
  if (!provider) {
    log(FN, null, null, "pagamento_indisponivel");
    return json({ error: "pagamento_indisponivel" }, 503); // configuração inválida: o provedor tenta de novo depois
  }

  let env: Envelope;
  try {
    env = JSON.parse(rawBody) as Envelope;
  } catch {
    log(FN, null, null, "corpo_invalido");
    return json({ ok: true });
  }
  const deliveryId = typeof env.id === "string" ? env.id : "";
  const eventType = typeof env.event === "string" ? env.event : "";
  const devMode = typeof env.devMode === "boolean" ? env.devMode : null;
  const t = env.data?.transparent ?? null;
  const chargeId = t && typeof t.id === "string" ? t.id : "";
  const metadata = (t && typeof t.metadata === "object" && t.metadata !== null ? t.metadata : {}) as Record<string, unknown>;
  const candidate = [t?.externalId, metadata.orderId].find((v): v is string => typeof v === "string" && UUID_RE.test(v)) ?? null;
  if (!deliveryId) {
    log(FN, candidate, null, "corpo_invalido");
    return json({ ok: true });
  }

  const admin = serviceClient();
  const rec = await admin.rpc("payments_record_event", {
    p_provider_event_id: deliveryId,
    p_type: eventType,
    p_order: candidate,
    p_outcome: "recebido",
    p_detail: { event: eventType, devMode },
  });
  if (rec.error) {
    log(FN, candidate, null, "erro_banco");
    return json({ error: "db" }, 500);
  }
  if (rec.data === false) {
    // entrega repetida: só reprocessa se a anterior não terminou (ficou 'recebido' porque o banco/provedor falhou)
    const prev = await admin.from("payment_events").select("outcome").eq("provider", "abacatepay").eq("provider_event_id", deliveryId).maybeSingle();
    if (prev.error) return json({ error: "db" }, 500);
    if (prev.data?.outcome !== "recebido") {
      log(FN, candidate, null, "duplicado");
      return json({ ok: true });
    }
  }
  const finish = async (orderId: string | null, status: string | null, outcome: string) => {
    const u = await admin.from("payment_events").update({ outcome }).eq("provider", "abacatepay").eq("provider_event_id", deliveryId);
    if (u.error) log(FN, orderId, status, "falha_ao_gravar_resultado");
    log(FN, orderId, status, outcome);
    return json({ ok: true });
  };

  if (!candidate) return finish(null, null, "pedido_desconhecido");
  const { order, error } = await loadOrder(admin, candidate);
  if (error) {
    log(FN, candidate, null, "erro_banco");
    return json({ error: "db" }, 500);
  }
  if (!order) return finish(null, null, "pedido_desconhecido");

  // devMode do evento (assinado pelo provedor) precisa bater com o ambiente configurado e com o do pedido
  if (devMode === null || devMode !== (provider.env === "sandbox") || order.provider_env !== provider.env) {
    return finish(order.id, order.status, "ambiente_divergente");
  }
  if (!chargeId) return finish(order.id, order.status, "cobranca_ausente");

  try {
    // cobrança criada mas não gravada (create sem resposta ou attach que falhou): o corpo do evento sozinho não basta.
    // Reconsulta GET /transparents/get?id= e só adota com externalId === pedido, mesmo valor e mesmo ambiente.
    let applyId = chargeId; // depois da adoção, sempre o id devolvido pelo provedor no get
    if (!order.provider_charge_id && order.status === "criado") {
      let charge;
      try {
        charge = await getPixCharge(provider.config, chargeId);
      } catch {
        log(FN, order.id, order.status, "reconsulta_falhou");
        return json({ error: "provider" }, 500);
      }
      if (!chargeMatchesOrder(charge, order)) return finish(order.id, order.status, "cobranca_nao_confere");
      const a = await admin.rpc("payments_attach_charge", {
        p_order: order.id, p_charge_id: charge.id, p_brcode: charge.brCode ?? null, p_brcode_base64: charge.brCodeBase64 ?? null,
        p_expires_at: charge.expiresAt ?? null, p_dev_mode: charge.devMode,
      });
      if (a.error) throw new Error("db"); // inclusive 23505: nunca é sucesso
      order.provider_charge_id = charge.id;
      order.status = "pendente";
      applyId = charge.id;
    }
    let state;
    try {
      state = await recheck(provider.config, applyId);
    } catch {
      log(FN, order.id, order.status, "reconsulta_falhou");
      return json({ error: "provider" }, 500); // sem o status reconsultado nada é aplicado; o provedor reenvia
    }
    if (!state.status) return finish(order.id, order.status, "status_desconhecido");
    const r = await applyStatus(admin, order, applyId, state, devMode, "webhook");
    return finish(order.id, r.to, r.applied ? "aplicado" : "nao_aplicado");
  } catch {
    log(FN, order.id, order.status, "erro_banco");
    return json({ error: "db" }, 500);
  }
});
