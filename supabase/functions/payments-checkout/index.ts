// Checkout do anfitrião (Mercado Pago, Checkout Pro por Preferences): abre (ou reusa) o pedido pela RPC do organizador e cria a
// preferência só uma vez. O pagamento acontece na página hospedada (init_point); nada é liberado por este retorno.
// - Mesma chave de idempotência → mesmo pedido; o pedido único aberto por evento serializa cliques duplos.
// - Quem reusa pedido ainda 'criado' espera poucos segundos pela preferência do outro; se não aparecer, cria a sua (a
//   duplicata é inofensiva: external_reference = pedido, e o banco mantém só a primeira preferência).
// - Erro/timeout na criação → 502 com o pedido mantido em 'criado' (o organizador tenta de novo e reusa o pedido; a
//   conciliação procura pagamentos por external_reference e falha o pedido sem preferência após 5 min).
import { createPreference, MercadoPagoError } from "../_shared/mercadopago.ts";
import { buildBackUrls, pickOrigin, PREFERENCE_TTL_MIN } from "../_shared/mercadopago-flow.ts";
import { allowedOrigins, caller, guardEnv, log, preflight, responder, serviceClient, UUID_RE } from "../_shared/payments-runtime.ts";

const FN = "payments-checkout";
const WAIT_OTHER_MS = 3_000;

type OrderJson = { orderId: string; status: string; amountCents: number; checkoutUrl: string | null; expiresAt: string | null; provider: string; paymentMethod: string | null; reused: boolean };
const out = (o: Omit<OrderJson, "reused">) => ({ orderId: o.orderId, status: o.status, amountCents: o.amountCents, checkoutUrl: o.checkoutUrl, expiresAt: o.expiresAt, provider: o.provider, paymentMethod: o.paymentMethod });

Deno.serve(async (req) => {
  const json = responder(req, true);
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const who = await caller(req);
  if (!who.ok) return json({ error: who.status === 401 ? "unauthorized" : "forbidden" }, who.status);

  let eventId = "", planCode = "", idempotencyKey = "";
  try {
    const b = (await req.json()) as Record<string, unknown>;
    eventId = String(b.eventId ?? "");
    planCode = String(b.planCode ?? "");
    idempotencyKey = String(b.idempotencyKey ?? "");
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (!UUID_RE.test(eventId) || !UUID_RE.test(idempotencyKey) || !/^[a-z0-9_-]{1,40}$/.test(planCode)) return json({ error: "invalid" }, 400);

  const admin = serviceClient();
  const provider = await guardEnv(admin);
  if (!provider) {
    log(FN, null, null, "pagamento_indisponivel");
    return json({ error: "pagamento_indisponivel" }, 503);
  }

  if (provider.env === "sandbox" && !Deno.env.get("MERCADOPAGO_BASE_URL")) { // BASE_URL só existe no fake local (a config recusa hosts externos)
    // Janela de homologação: só Master compra em sandbox. Visitante/organizador real nunca cria pedido de teste.
    const m = await who.client.rpc("is_master");
    if (m.error || m.data !== true) {
      log(FN, null, null, "sandbox_restrito");
      return json({ error: "sandbox_restrito" }, 403);
    }
  }

  const opened = await who.client.rpc("payments_open_order", { p_event: eventId, p_plan: planCode, p_idempotency_key: idempotencyKey });
  if (opened.error) {
    switch (opened.error.code) {
      case "MM013": {
        const { data } = await admin.from("payment_orders").select("id").eq("event_id", eventId).in("status", ["criado", "pendente"]).maybeSingle();
        return json({ error: "pedido_aberto", orderId: data?.id ?? null }, 409);
      }
      case "MM002":
        return json({ error: "evento_encerrado" }, 422);
      case "MM014":
        return json({ error: "plano_inativo" }, 422);
      case "MM004":
        return json({ error: "forbidden" }, 403);
      case "MM005": {
        const q = await who.client.rpc("payments_quote", { p_event: eventId, p_plan: planCode });
        const reason = (q.data as { reason?: string } | null)?.reason;
        if (reason === "ja_incluido" || reason === "valor_minimo" || reason === "plano_inativo" || reason === "evento_encerrado") return json({ error: reason }, 422);
        return json({ error: "invalid" }, 400);
      }
      default:
        log(FN, null, null, "erro_banco");
        return json({ error: "indisponivel" }, 500);
    }
  }
  const order = opened.data as OrderJson;

  if (order.status !== "criado") {
    log(FN, order.orderId, order.status, "reusado");
    return json(out(order));
  }

  const reread = async () => (await admin.from("payment_orders").select("id,status,amount_cents,checkout_url,expires_at,provider,payment_method").eq("id", order.orderId).maybeSingle()).data;

  if (order.reused) {
    const end = Date.now() + WAIT_OTHER_MS;
    while (Date.now() < end) {
      await new Promise((r) => setTimeout(r, 400));
      const d = await reread();
      if (d && d.status !== "criado") {
        log(FN, order.orderId, d.status, "reusado");
        return json({ orderId: d.id, status: d.status, amountCents: d.amount_cents, checkoutUrl: d.checkout_url, expiresAt: d.expires_at, provider: d.provider, paymentMethod: d.payment_method });
      }
    }
  }

  const { data: planRow } = await admin.from("plans").select("name, max_guests").eq("code", planCode).maybeSingle();
  const payerEmail = (await who.client.auth.getUser()).data.user?.email ?? null;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PREFERENCE_TTL_MIN * 60_000).toISOString();
  const origin = pickOrigin(req.headers.get("origin"), allowedOrigins(), provider.env);
  const webhookUrl = Deno.env.get("PAYMENTS_WEBHOOK_URL") || `${Deno.env.get("SUPABASE_URL")}/functions/v1/payments-webhook`;
  let pref;
  try {
    pref = await createPreference(provider.config, {
      orderId: order.orderId, eventId, planCode, amountCents: order.amountCents,
      title: `MemoriesMT - plano ${planRow?.name ?? planCode}`.slice(0, 120),
      notificationUrl: webhookUrl, backUrls: buildBackUrls(origin, eventId), expiresAt, now: now.toISOString(),
      payerEmail,
      description: `Pagamento único por evento${planRow?.max_guests ? `, até ${planRow.max_guests} convidados` : ""}. Sem assinatura.`,
    });
  } catch (e) {
    log(FN, order.orderId, "criado", e instanceof MercadoPagoError ? `provedor_${e.kind}` : "provedor_erro");
    return json({ error: "provedor_indisponivel", orderId: order.orderId }, 502);
  }

  let attached = false;
  const BACKOFF_MS = [200, 500, 1_000];
  for (let i = 0; i <= BACKOFF_MS.length && !attached; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, BACKOFF_MS[i - 1]));
    const a = await admin.rpc("payments_attach_preference", {
      p_order: order.orderId, p_preference_id: pref.id, p_checkout_url: pref.initPoint, p_expires_at: pref.expirationDateTo ?? expiresAt,
    });
    attached = !a.error;
    if (a.error?.code === "MM005") break;
  }
  if (!attached) {
    log(FN, order.orderId, "criado", "falha_ao_gravar_preferencia");
    return json({ error: "provedor_indisponivel", orderId: order.orderId }, 502);
  }
  const d = await reread(); // o banco mantém a primeira preferência se houve corrida
  log(FN, order.orderId, d?.status ?? "pendente", "preferencia_criada");
  return json({
    orderId: order.orderId, status: d?.status ?? "pendente", amountCents: order.amountCents, checkoutUrl: d?.checkout_url ?? pref.initPoint,
    expiresAt: d?.expires_at ?? expiresAt, provider: "mercadopago", paymentMethod: d?.payment_method ?? null,
  });
});
