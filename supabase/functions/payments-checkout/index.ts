// Checkout Pix do anfitrião: abre (ou reusa) o pedido pela RPC do organizador e cria a cobrança na AbacatePay só uma vez.
// - Mesma chave de idempotência → mesmo pedido; o pedido único aberto por evento serializa cliques duplos.
// - Quem não criou o pedido (reuso de pedido ainda 'criado') espera a cobrança aparecer; nunca chama create de novo.
// - Erro na criação (inclusive rede/timeout, em que a cobrança pode existir) → 502 com o pedido mantido em 'criado';
//   a reconciliação procura a cobrança pelo externalId e, sem achar, marca 'falhou' após 5 min (libera novo checkout).
import { createPixCharge } from "../_shared/abacatepay.ts";
import { AbacateError, caller, guardEnv, log, preflight, responder, serviceClient, UUID_RE } from "../_shared/payments-runtime.ts";

const FN = "payments-checkout";
const EXPIRES_IN_SEC = 30 * 60;
const WAIT_OTHER_MS = 10_000;

type OrderJson = { orderId: string; status: string; amountCents: number; brCode: string | null; brCodeBase64: string | null; expiresAt: string | null; reused: boolean };

const out = (o: OrderJson) => ({ orderId: o.orderId, status: o.status, amountCents: o.amountCents, brCode: o.brCode, brCodeBase64: o.brCodeBase64, expiresAt: o.expiresAt });

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
        // plano já incluído (ou abaixo do mínimo cobrável) vs. entrada inválida: a cotação diz qual
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
  let order = opened.data as OrderJson;

  if (order.status !== "criado") {
    log(FN, order.orderId, order.status, "reusado");
    return json(out(order));
  }

  if (order.reused) {
    // outro pedido (clique duplo ou tentativa anterior) está criando a cobrança: espera, nunca cria de novo
    const end = Date.now() + WAIT_OTHER_MS;
    while (Date.now() < end) {
      await new Promise((r) => setTimeout(r, 400));
      const { data } = await admin.from("payment_orders")
        .select("id,status,amount_cents,brcode,brcode_base64,expires_at").eq("id", order.orderId).maybeSingle();
      if (data && data.status !== "criado") {
        log(FN, order.orderId, data.status, "reusado");
        return json({ orderId: data.id, status: data.status, amountCents: data.amount_cents, brCode: data.brcode, brCodeBase64: data.brcode_base64, expiresAt: data.expires_at });
      }
    }
    log(FN, order.orderId, "criado", "provedor_indisponivel");
    return json({ error: "provedor_indisponivel", orderId: order.orderId }, 502);
  }

  const { data: planRow } = await admin.from("plans").select("name").eq("code", planCode).maybeSingle();
  let charge;
  try {
    charge = await createPixCharge(provider.config, {
      amountCents: order.amountCents,
      expiresInSec: EXPIRES_IN_SEC,
      description: `MemoriesMT - plano ${planRow?.name ?? planCode}`.slice(0, 140),
      externalId: order.orderId,
      metadata: { orderId: order.orderId, eventId, planCode, env: provider.env },
    });
  } catch (e) {
    log(FN, order.orderId, "criado", e instanceof AbacateError ? `provedor_${e.kind}` : "provedor_erro");
    return json({ error: "provedor_indisponivel", orderId: order.orderId }, 502);
  }

  let attached = false;
  for (let i = 0; i < 3 && !attached; i++) {
    const a = await admin.rpc("payments_attach_charge", {
      p_order: order.orderId,
      p_charge_id: charge.id,
      p_brcode: charge.brCode,
      p_brcode_base64: charge.brCodeBase64,
      p_expires_at: charge.expiresAt,
      p_dev_mode: charge.devMode,
    });
    attached = !a.error;
    if (a.error?.code === "MM005") break; // recusa de regra (ex.: devMode divergente): não adianta repetir
  }
  if (!attached) {
    // a cobrança existe no provedor mas não foi gravada: a reconciliação a acha pelo externalId e a adota
    log(FN, order.orderId, "criado", "falha_ao_gravar_cobranca");
    return json({ error: "provedor_indisponivel", orderId: order.orderId }, 502);
  }
  order = { ...order, status: "pendente", brCode: charge.brCode, brCodeBase64: charge.brCodeBase64, expiresAt: charge.expiresAt };
  log(FN, order.orderId, "pendente", "cobranca_criada");
  return json(out(order));
});
