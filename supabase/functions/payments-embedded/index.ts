// Checkout Transparente via Mercado Pago Payments API; isolated from legacy Checkout Pro.
// Production disabled unless explicitly approved via Supabase Edge secrets.
import { createEmbeddedPayment, getEmbeddedReceipt, getPayment, MercadoPagoError } from "../_shared/mercadopago.ts";
import {
  applyPayment, caller, expectedCollector, guardEnv, loadOrder, log,
  preflight, responder, serviceClient, UUID_RE,
} from "../_shared/payments-runtime.ts";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string" ? v.trim() : "";
const publicKey = (env: string) => {
  const v = Deno.env.get(env === "sandbox" ? "MERCADOPAGO_PUBLIC_KEY_SANDBOX" : "MERCADOPAGO_PUBLIC_KEY") ?? "";
  return /^[A-Za-z0-9_-]{10,160}$/.test(v) ? v : null;
};
const allow = (env: string) =>
  Deno.env.get("PAYMENTS_EMBEDDED_ENABLED") === "true" &&
  (env === "sandbox" || Deno.env.get("PAYMENTS_EMBEDDED_PRODUCTION_ENABLED") === "true");

Deno.serve(async (req) => {
  const send = responder(req, true);
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return send({ error: "method" }, 405);
  const who = await caller(req);
  if (!who.ok) return send({ error: "forbidden" }, who.status);

  let body: Obj;
  try {
    const b: unknown = await req.json();
    if (!isObj(b)) return send({ error: "invalid" }, 400);
    body = b;
  } catch { return send({ error: "invalid" }, 400); }
  const action = str(body.action);
  if (!["config", "submit", "recover"].includes(action)) return send({ error: "invalid" }, 400);

  const admin = serviceClient();
  const provider = await guardEnv(admin);
  if (!provider) return send({ error: "pagamento_indisponivel", enabled: false }, 503);
  const key = publicKey(provider.env);
  const enabled = allow(provider.env) && !!key;

  if (action === "config") return send({ enabled, publicKey: enabled ? key : null, env: provider.env });
  if (!enabled) return send({ error: "checkout_integrado_indisponivel" }, 503);

  if (provider.env === "sandbox" && !Deno.env.get("MERCADOPAGO_BASE_URL")) {
    const m = await who.client.rpc("is_master");
    if (m.error || m.data !== true) return send({ error: "sandbox_restrito" }, 403);
  }

  if (action === "recover") {
    const orderId = str(body.orderId);
    if (!UUID_RE.test(orderId)) return send({ error: "invalid" }, 400);
    const owner = await who.client.rpc("payments_order_status", { p_order: orderId });
    if (owner.error) return send({ error: "nao_encontrado" }, 404);
    const { order } = await loadOrder(admin, orderId);
    if (!order || order.provider_env !== provider.env || order.provider !== "mercadopago")
      return send({ error: "nao_encontrado" }, 404);
    if (!["criado", "pendente"].includes(order.status))
      return send({ orderId, status: order.status });
    const { data: charges, error } = await admin.from("payment_charges")
      .select("payment_id,status,payment_method")
      .eq("order_id", orderId).eq("payment_method", "pix")
      .order("id", { ascending: false }).limit(1);
    if (error) return send({ error: "indisponivel" }, 500);
    const paymentId = charges?.[0]?.payment_id;
    if (!paymentId) return send({ orderId, status: order.status });
    try {
      const [receipt, payment] = await Promise.all([
        getEmbeddedReceipt(provider.config, paymentId),
        getPayment(provider.config, paymentId),
      ]);
      if (payment.externalReference !== orderId) return send({ error: "nao_encontrado" }, 404);
      return send({ orderId, status: order.status, ...receipt });
    } catch { return send({ orderId, error: "indisponivel" }, 503); }
  }

  const eventId = str(body.eventId), planCode = str(body.planCode), idempotencyKey = str(body.idempotencyKey);
  if (!UUID_RE.test(eventId) || !UUID_RE.test(idempotencyKey) ||
      !/^[a-z0-9_-]{1,40}$/.test(planCode) || !isObj(body.formData))
    return send({ error: "invalid" }, 400);

  const form = body.formData;
  const paymentMethodId = str(form.payment_method_id);
  const method: "pix" | "card" = paymentMethodId === "pix" ? "pix" : "card";
  const token = str(form.token);
  const installments = Number(form.installments);
  if (method === "card" && (!/^[a-z][a-z0-9_]{2,31}$/.test(paymentMethodId) ||
       !/^[A-Za-z0-9_-]{12,256}$/.test(token) ||
       !Number.isInteger(installments) || installments < 1 || installments > 12))
    return send({ error: "invalid" }, 400);
  const issuerValue = Number(form.issuer_id);
  const issuerId = Number.isSafeInteger(issuerValue) && issuerValue > 0 && issuerValue < 100000 ? issuerValue : undefined;

  const payer = isObj(form.payer) ? form.payer : {};
  const identification = isObj(payer.identification) ? payer.identification : {};
  const cpf = str(identification.number).replace(/\D/g, "");
  if (str(identification.type) !== "CPF" || !/^\d{11}$/.test(cpf))
    return send({ error: "cpf_invalido" }, 422);

  const authUser = (await who.client.auth.getUser()).data.user;
  const email = str(authUser?.email);
  if (!authUser?.email_confirmed_at || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return send({ error: "email_nao_verificado" }, 403);

  const opened = await who.client.rpc("payments_open_order", {
    p_event: eventId, p_plan: planCode, p_idempotency_key: idempotencyKey,
  });
  if (opened.error) {
    const code = opened.error.code;
    if (code === "MM004") return send({ error: "forbidden" }, 403);
    if (code === "MM013") return send({ error: "pedido_aberto" }, 409);
    if (code === "MM002") return send({ error: "evento_encerrado" }, 422);
    if (code === "MM014") return send({ error: "plano_inativo" }, 422);
    return send({ error: "indisponivel" }, 500);
  }
  const openedOrder = opened.data as { orderId: string };
  const orderId = openedOrder.orderId;
  const { order } = await loadOrder(admin, orderId);
  if (!order || order.host_id !== who.userId || order.event_id !== eventId ||
      order.plan_code !== planCode || order.provider_env !== provider.env ||
      order.provider !== "mercadopago") return send({ error: "forbidden" }, 403);
  if (order.mp_preference_id || order.checkout_url)
    return send({ error: "pedido_checkout_antigo", orderId }, 409);
  if (order.status !== "criado") return send({ error: "pedido_aberto", orderId }, 409);
  if (!Number.isSafeInteger(order.amount_cents) || order.amount_cents < 100)
    return send({ error: "valor_invalido" }, 422);

  const reserved = await admin.rpc("payments_reserve_embedded", {
    p_order: orderId, p_method: method,
  });
  if (reserved.error) return send({ error: "configuracao_pendente", orderId }, 503);
  if (reserved.data !== true) return send({ error: "pedido_aberto", orderId }, 409);

  const notificationUrl = Deno.env.get("PAYMENTS_WEBHOOK_URL") ||
    Deno.env.get("SUPABASE_URL") + "/functions/v1/payments-webhook";
  let receipt: Awaited<ReturnType<typeof createEmbeddedPayment>>;
  try {
    receipt = await createEmbeddedPayment(provider.config, {
      orderId, amountCents: order.amount_cents, paymentMethodId, payerEmail: email,
      payerDocument: { type: "CPF", number: cpf },
      ...(method === "card" ? { card: { token, installments, issuerId } } : {}),
      description: "MemoriesMT plano " + planCode,
      notificationUrl,
    });
  } catch (e) {
    log("payments-embedded", orderId, "criado",
      e instanceof MercadoPagoError ? "provedor_" + e.kind : "provedor_erro");
    return send({ error: "provedor_indisponivel", orderId }, 502);
  }
  try {
    const [collector, payment] = await Promise.all([
      expectedCollector(provider.config), getPayment(provider.config, receipt.paymentId),
    ]);
    if (payment.externalReference !== orderId)
      return send({ error: "divergencia_cobranca", orderId }, 409);
    const applied = await applyPayment(admin, orderId, payment, collector, "status");
    if (!["aplicado","duplicado","tentativa_recusada"].includes(applied.outcome))
      return send({ error: "revisao_financeira", orderId }, 409);
    if (["rejected","cancelled"].includes(payment.status))
      await admin.rpc("payments_close_rejected_embedded", {
        p_order: orderId, p_payment_id: receipt.paymentId,
      });
    log("payments-embedded", orderId, applied.to || payment.status, "integrado");
    return send({
      orderId, status: payment.status, paymentId: receipt.paymentId,
      qrCode: method === "pix" ? receipt.qrCode : null,
      qrCodeBase64: method === "pix" ? receipt.qrCodeBase64 : null,
      amountCents: order.amount_cents,
      statusDetail: receipt.statusDetail,
    });
  } catch {
    log("payments-embedded", orderId, null, "confirmacao_pendente");
    return send({ orderId, error: "confirmacao_pendente" }, 202);
  }
});
