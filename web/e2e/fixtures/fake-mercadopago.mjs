// Mercado Pago FALSO, só para testes automatizados locais (integração/e2e). NÃO É HOMOLOGAÇÃO EXTERNA: não prova nada sobre a
// API real nem sobre o painel; é uma réplica do contrato que o código consome. Estado em memória; nenhuma chamada sai da máquina.
// Implementa: POST /checkout/preferences · GET /checkout/preferences/search · GET /v1/payments/{id} ·
// GET /v1/payments/search · POST /v1/payments/{id}/refunds (X-Idempotency-Key) · GET /users/me, e entrega webhooks com
// x-signature IDÊNTICO ao real: `ts=<unix>,v1=<hmac-sha256 hex de "id:<data.id minúsculo>;request-id:<x-request-id>;ts:<ts>;">`.
//
// Uso: import { startFakeMercadoPago, signWebhook } from "./fake-mercadopago.mjs"
//   ou: node web/e2e/fixtures/fake-mercadopago.mjs  (FAKE_MERCADOPAGO_PORT, FAKE_MERCADOPAGO_WEBHOOK_URL, MERCADOPAGO_WEBHOOK_SECRET)
// Controle (só testes): POST /__control/reset | /config {failCreate, failCreateAfterCreate, createDelayMs, maxPageSize, deliverWebhooks,
//   pixRefundInProcess, collectorId, failGet, failSearch} | /pay {externalReference, amount?, status?, method?, liveMode?, collectorId?,
//   currencyId?, deliver?} | /status {id, status, ...campos} | /webhook {paymentId, sign?, secret?, tsOffsetSec?, requestId?,
//   omitRequestId?, dataIdQuery?} | /settle-refund {paymentId} | /late-delivery (reenvia a última entrega, duplicada);
//   GET /__control/calls | /payments | /deliveries | /preferences.
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import http from "node:http";
import { pathToFileURL } from "node:url";

export function signWebhook(secret, { dataId, requestId, ts }) {
  const id = /^[A-Za-z0-9]+$/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `${id ? `id:${id};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
  return createHmac("sha256", secret).update(manifest, "utf8").digest("hex");
}

export function startFakeMercadoPago({ port = 0, webhookUrl = "", webhookSecret = "", host = "0.0.0.0" } = {}) {
  const fresh = () => ({ failCreate: null, failCreateAfterCreate: null, createDelayMs: 0, maxPageSize: 50, deliverWebhooks: true, pixRefundInProcess: false, collectorId: 900001, failGet: null, failSearch: null });
  let config = fresh();
  const idBase = 1_000_000_000 + Math.floor(Math.random() * 8_000_000_000);
  let calls, preferences, payments, refunds, idem, deliveries, seq;
  const reset = () => {
    calls = { create: 0, getPayment: 0, search: 0, refund: 0, me: 0, prefSearch: 0 };
    preferences = new Map(); payments = new Map(); refunds = []; idem = new Map(); deliveries = []; seq = 0;
  };
  reset();

  const send = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const err = (res, status, error, message = "erro simulado") => send(res, status, { message, error, status, cause: [] });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const view = (p) => ({
    id: p.id, status: p.status, status_detail: p.status === "approved" ? "accredited" : "pending", transaction_amount: p.amount, currency_id: p.currencyId,
    live_mode: p.liveMode, collector_id: p.collectorId, external_reference: p.externalReference, payment_method_id: p.method,
    date_created: p.createdAt, date_last_updated: p.updatedAt, transaction_amount_refunded: p.refunded,
    payer: { email: "comprador.ficticio@teste.invalid", identification: { type: "CPF", number: "00000000000" } },
  });

  function touch(p, status) { if (status) p.status = status; p.updatedAt = new Date(Date.now() + (++seq)).toISOString(); }

  async function deliver(p, o = {}) {
    if (!webhookUrl) return null;
    const ts = Math.floor(Date.now() / 1000) + (o.tsOffsetSec ?? 0);
    const requestId = o.omitRequestId ? "" : (o.requestId ?? randomUUID());
    const dataIdQuery = o.dataIdQuery ?? String(p.id);
    const body = JSON.stringify({ action: "payment.updated", api_version: "v1", data: { id: String(p.id) }, date_created: new Date().toISOString(), id: Math.floor(Math.random() * 1e9), live_mode: p.liveMode, type: "payment", user_id: config.collectorId });
    const secret = o.secret ?? webhookSecret;
    const v1 = signWebhook(secret, { dataId: dataIdQuery, requestId, ts });
    const headers = { "content-type": "application/json" };
    if (o.sign !== false) headers["x-signature"] = `ts=${ts},v1=${v1}`;
    if (requestId) headers["x-request-id"] = requestId;
    const url = `${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}data.id=${encodeURIComponent(dataIdQuery)}&type=payment`;
    const d = { paymentId: p.id, status: null, body, headers, url };
    try { const r = await fetch(url, { method: "POST", headers, body }); d.status = r.status; } catch { d.status = 0; }
    deliveries.push(d);
    return d;
  }

  function newPayment({ externalReference, amount, status = "approved", method = "pix", liveMode = false, collectorId, currencyId = "BRL" }) {
    const now = new Date().toISOString();
    const id = String(idBase * 10 + (++seq)); // base aleatória por instância: o banco local persiste entre execuções
    const p = { id, externalReference, amount, status, method, liveMode, collectorId: collectorId ?? config.collectorId, currencyId, refunded: 0, createdAt: now, updatedAt: new Date(Date.now() + (++seq)).toISOString(), pendingRefund: null };
    payments.set(id, p);
    return p;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8");
      let body = null; try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
      const u = new URL(req.url, "http://x");
      const path = u.pathname;

      if (path.startsWith("/__control/")) {
        if (path === "/__control/reset") { reset(); config = fresh(); return send(res, 200, { ok: true }); }
        if (path === "/__control/config") { config = { ...config, ...(body ?? {}) }; return send(res, 200, config); }
        if (path === "/__control/calls") return send(res, 200, { ...calls });
        if (path === "/__control/payments") return send(res, 200, [...payments.values()].map(view));
        if (path === "/__control/preferences") return send(res, 200, [...preferences.values()]);
        if (path === "/__control/deliveries") return send(res, 200, deliveries.map(({ paymentId, status, url }) => ({ paymentId, status, url })));
        if (path === "/__control/pay") {
          const p = newPayment({ externalReference: body.externalReference, amount: body.amount, status: body.status, method: body.method, liveMode: body.liveMode, collectorId: body.collectorId, currencyId: body.currencyId });
          if (body.amount === undefined) { const pref = [...preferences.values()].find((x) => x.external_reference === body.externalReference); p.amount = pref ? pref.amount : 0; }
          if (body.deliver !== false && config.deliverWebhooks) await deliver(p);
          return send(res, 200, view(p));
        }
        if (path === "/__control/status") {
          const p = payments.get(String(body.id)); if (!p) return err(res, 404, "not_found");
          touch(p, body.status);
          if (body.refunded !== undefined) p.refunded = body.refunded;
          if (body.amount !== undefined) p.amount = body.amount;
          if (body.deliver !== false && config.deliverWebhooks) await deliver(p);
          return send(res, 200, view(p));
        }
        if (path === "/__control/webhook") {
          const p = payments.get(String(body.paymentId)) ?? { id: String(body.paymentId), liveMode: false };
          const d = await deliver(p, body);
          return send(res, 200, { status: d?.status ?? null });
        }
        if (path === "/__control/settle-refund") {
          const p = payments.get(String(body.paymentId)); if (!p || !p.pendingRefund) return err(res, 404, "not_found");
          p.refunded += p.pendingRefund; p.pendingRefund = null; if (p.refunded >= p.amount) touch(p, "refunded"); else touch(p);
          if (config.deliverWebhooks) await deliver(p);
          return send(res, 200, view(p));
        }
        return err(res, 404, "not_found");
      }

      if (!/^Bearer \S+/.test(req.headers.authorization ?? "")) return err(res, 401, "unauthorized", "token ausente");

      if (req.method === "GET" && path === "/users/me") { calls.me++; return send(res, 200, { id: config.collectorId, nickname: "LOJA_FICTICIA", site_id: "MLB", country_id: "BR", email: "dono@teste.invalid" }); }

      if (req.method === "POST" && path === "/checkout/preferences") {
        calls.create++;
        if (config.createDelayMs) await sleep(config.createDelayMs);
        const item = body?.items?.[0];
        if (!item || !body.external_reference) return err(res, 400, "invalid_items", "items obrigatório");
        const id = `${config.collectorId}-${randomBytes(8).toString("hex")}`;
        const pref = { id, external_reference: body.external_reference, amount: item.unit_price, body, init_point: `https://fake.mercadopago.test/checkout/v1/redirect?pref_id=${id}`, sandbox_init_point: `https://sandbox.fake.mercadopago.test/checkout/v1/redirect?pref_id=${id}` };
        if (config.failCreateAfterCreate) { preferences.set(id, pref); return err(res, config.failCreateAfterCreate, "internal_error"); }
        if (config.failCreate) return err(res, config.failCreate, "internal_error");
        preferences.set(id, pref);
        return send(res, 201, { id, init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point, collector_id: config.collectorId, date_created: new Date().toISOString(), expiration_date_to: body.expiration_date_to ?? null });
      }
      if (req.method === "GET" && path === "/checkout/preferences/search") { calls.prefSearch++; return send(res, 200, { paging: { total: preferences.size, limit: Number(u.searchParams.get("limit") ?? 30), offset: 0 }, elements: [...preferences.values()].slice(0, 1).map((p) => ({ id: p.id })) }); }

      if (req.method === "GET" && path === "/v1/payments/search") {
        calls.search++;
        if (config.failSearch) return err(res, config.failSearch, "internal_error");
        const ref = u.searchParams.get("external_reference");
        const limit = Math.min(Number(u.searchParams.get("limit") ?? 30), config.maxPageSize), offset = Number(u.searchParams.get("offset") ?? 0);
        const all = [...payments.values()].filter((p) => p.externalReference === ref).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
        return send(res, 200, { paging: { total: all.length, limit, offset }, results: all.slice(offset, offset + limit).map(view) });
      }
      let m = /^\/v1\/payments\/([^/]+)$/.exec(path);
      if (req.method === "GET" && m) {
        calls.getPayment++;
        if (config.failGet) return err(res, config.failGet, "internal_error");
        const p = payments.get(m[1]); if (!p) return err(res, 404, "not_found", "Payment not found");
        return send(res, 200, view(p));
      }
      m = /^\/v1\/payments\/([^/]+)\/refunds$/.exec(path);
      if (req.method === "POST" && m) {
        calls.refund++;
        const key = req.headers["x-idempotency-key"];
        if (!key) return err(res, 400, "idempotency_key_missing", "X-Idempotency-Key obrigatório");
        const sig = `${m[1]}|${JSON.stringify(body ?? {})}`;
        const prev = idem.get(key);
        if (prev) return prev.sig === sig ? send(res, 201, prev.resp) : err(res, 409, "idempotency_key_already_used");
        const p = payments.get(m[1]); if (!p) return err(res, 404, "not_found", "Payment not found");
        if (p.status !== "approved") return err(res, 400, "invalid_status", "pagamento não reembolsável");
        const amount = body?.amount ?? (p.amount - p.refunded);
        if (amount <= 0 || amount > p.amount - p.refunded + 1e-9) return err(res, 400, "refund_amount_exceeds", "valor acima do saldo");
        const r = { id: 70_000 + refunds.length, payment_id: Number(p.id) || p.id, amount, status: config.pixRefundInProcess && p.method === "pix" ? "in_process" : "approved" };
        refunds.push({ ...r, key });
        if (r.status === "approved") { p.refunded += amount; if (p.refunded >= p.amount - 1e-9) touch(p, "refunded"); else touch(p); if (config.deliverWebhooks) await deliver(p); }
        else p.pendingRefund = amount;
        idem.set(key, { sig, resp: r });
        return send(res, 201, r);
      }
      return err(res, 404, "not_found");
    } catch { return err(res, 500, "internal_error"); }
  });

  return new Promise((resolve) => server.listen(port, host, () => resolve({
    port: server.address().port,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  })));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const s = await startFakeMercadoPago({ port: Number(process.env.FAKE_MERCADOPAGO_PORT ?? 56491), webhookUrl: process.env.FAKE_MERCADOPAGO_WEBHOOK_URL ?? "", webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "" });
  console.log(`fake-mercadopago em http://127.0.0.1:${s.port} (NÃO é homologação externa)`);
}
