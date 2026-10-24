// HISTÓRICO (AbacatePay): mantido só porque web/e2e/payments.spec.ts (UI) ainda o importa; o fake ativo é fake-mercadopago.mjs.
// AbacatePay v2 falsa, só para testes locais (integração/e2e). Estado em memória; nenhuma chamada sai da máquina.
// Implementa /v2/transparents/create | check | get | list | refund | simulate-payment e envia webhooks assinados como o provedor:
// POST <FAKE_ABACATEPAY_WEBHOOK_URL> (já com ?webhookSecret=) e X-Webhook-Signature = base64(HMAC-SHA256(ABACATEPAY_HMAC_KEY, corpo bruto)).
//
// Uso: node web/e2e/fixtures/fake-abacatepay.mjs   (variáveis: FAKE_ABACATEPAY_PORT, FAKE_ABACATEPAY_WEBHOOK_URL,
//      ABACATEPAY_HMAC_KEY; opcional FAKE_ABACATEPAY_ENV_FILE com KEY=VALUE por linha)
// ou:  import { startFakeAbacatePay } from "./fake-abacatepay.mjs"
//
// Como a documentação garante: `check` devolve só {status, expiresAt}; create/get/list trazem `metadata` mas OMITEM
// `externalId` (só o webhook o traz com certeza) — a menos que config.includeExternalId = true; `list` pagina com
// limit/after/startDate, mais novas primeiro, e IGNORA os filtros id/externalId (pior caso: o cliente confere sozinho) —
// a menos que config.honorUndocumentedFilters = true.
// Controle (só testes): POST /__control/reset | /__control/config {failCreate, failCreateAfterCreate, deliverWebhooks,
// maxPageSize, honorUndocumentedFilters} | /__control/webhook {chargeId, event?, id?, devMode?, sign?, secret?, externalId?}
// | /__control/charge {externalId?, metadata?, amount, status?, devMode?} (cobrança avulsa) | /__control/status {id, status} ;
// GET /__control/calls | /__control/charges | /__control/deliveries.
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import { pathToFileURL } from "node:url";

const DEV_PREFIX = "abc_dev_";
const ALREADY_REFUNDED = "Esta cobrança já foi reembolsada.";
const EVENT_FOR_STATUS = { PAID: "transparent.completed", REFUNDED: "transparent.refunded", UNDER_DISPUTE: "transparent.disputed" };

export function signBody(hmacKey, rawBody) {
  return createHmac("sha256", hmacKey).update(rawBody, "utf8").digest("base64");
}

export function startFakeAbacatePay({ port = 0, webhookUrl = "", hmacKey = "", host = "0.0.0.0" } = {}) {
  let charges = new Map();
  const freshCalls = () => ({ create: 0, check: 0, get: 0, list: 0, refund: 0, simulate: 0 });
  const freshConfig = () => ({ failCreate: null, failCreateAfterCreate: null, deliverWebhooks: true, maxPageSize: 100, honorUndocumentedFilters: false, includeExternalId: false });
  let calls = freshCalls();
  let config = freshConfig();
  let seq = 0;
  const deliveries = [];

  const send = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const ok = (res, data) => send(res, 200, { data, success: true, error: null });
  const fail = (res, status, error) => send(res, status, { data: null, success: false, error });
  const view = (c) => ({
    id: c.id, amount: c.amount, status: c.status, devMode: c.devMode, brCode: c.brCode, brCodeBase64: c.brCodeBase64,
    platformFee: 80, receiptUrl: null, createdAt: c.createdAt, updatedAt: c.updatedAt, expiresAt: c.expiresAt, metadata: c.metadata,
  });

  function newCharge({ amount, expiresIn = 3600, externalId = null, metadata = {}, status = "PENDING", devMode = true }) {
    const now = new Date();
    const id = `pix_char_fake_${randomBytes(9).toString("hex")}`;
    const c = {
      id, seq: ++seq, amount, status, devMode,
      brCode: `00020101021226950014br.gov.bcb.pix-FAKE-${id}`, brCodeBase64: "data:image/png;base64,RkFLRQ==",
      createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + expiresIn * 1000).toISOString(),
      externalId, metadata,
    };
    charges.set(id, c);
    return c;
  }

  // resposta pública de create/get/list: externalId só com config.includeExternalId
  const apiView = (c) => (config.includeExternalId ? { ...view(c), externalId: c.externalId } : view(c));

  async function deliver(c, { event, id, devMode, sign = true, secretOverride, externalId } = {}) {
    const payload = {
      id: id ?? `log_fake_${randomBytes(8).toString("hex")}`,
      event: event ?? EVENT_FOR_STATUS[c.status] ?? "transparent.completed",
      apiVersion: 2,
      devMode: devMode ?? c.devMode,
      data: {
        transparent: { ...view(c), externalId: externalId !== undefined ? externalId : c.externalId, paidAmount: null, items: [], methods: [], frequency: "ONE_TIME", coupons: [], customerId: null },
        customer: null,
        payerInformation: { method: "PIX", PIX: { name: "Pagador Ficticio", taxId: "000.***.000-**", isSameAsCustomer: false } },
      },
    };
    const raw = JSON.stringify(payload);
    let url = webhookUrl;
    if (secretOverride !== undefined) {
      const u = new URL(webhookUrl);
      if (secretOverride === null) u.searchParams.delete("webhookSecret"); else u.searchParams.set("webhookSecret", secretOverride);
      url = u.toString();
    }
    const headers = { "content-type": "application/json" };
    if (sign) headers["x-webhook-signature"] = signBody(hmacKey, raw);
    let status = 0, body = null;
    try {
      const r = await fetch(url, { method: "POST", headers, body: raw });
      status = r.status;
      body = await r.text();
      try { body = JSON.parse(body); } catch { /* texto */ }
    } catch {
      status = 0;
    }
    const d = { eventId: payload.id, event: payload.event, chargeId: c.id, status, body };
    deliveries.push(d);
    return d;
  }

  async function readBody(req) {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const text = Buffer.concat(chunks).toString("utf8");
    if (!text) return {};
    try { return JSON.parse(text); } catch { return null; }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url ?? "/", "http://fake");
      const path = u.pathname;

      if (path.startsWith("/__control/")) {
        const body = req.method === "POST" ? await readBody(req) : {};
        if (path === "/__control/reset") {
          charges = new Map(); calls = freshCalls(); config = freshConfig();
          deliveries.length = 0;
          return send(res, 200, { ok: true });
        }
        if (path === "/__control/config") { config = { ...config, ...(body ?? {}) }; return send(res, 200, config); }
        if (path === "/__control/calls") return send(res, 200, { ...calls });
        if (path === "/__control/charges") return send(res, 200, [...charges.values()].map((c) => ({ ...view(c), externalId: c.externalId })));
        if (path === "/__control/deliveries") return send(res, 200, deliveries);
        if (path === "/__control/status") {
          const c = charges.get(body?.id);
          if (!c) return send(res, 404, { error: "not_found" });
          c.status = body.status; c.updatedAt = new Date().toISOString();
          return send(res, 200, view(c));
        }
        if (path === "/__control/webhook") {
          const c = charges.get(body?.chargeId);
          if (!c) return send(res, 404, { error: "not_found" });
          return send(res, 200, await deliver(c, { event: body.event, id: body.id, devMode: body.devMode, sign: body.sign !== false, secretOverride: body.secret, externalId: body.externalId }));
        }
        if (path === "/__control/charge") {
          const c = newCharge({ amount: Number(body?.amount), externalId: body?.externalId ?? null, metadata: body?.metadata ?? {}, status: body?.status ?? "PENDING", devMode: body?.devMode ?? true });
          return send(res, 200, { ...view(c), externalId: c.externalId });
        }
        return send(res, 404, { error: "not_found" });
      }

      // API pública falsa: exige Bearer abc_dev_ (a fake só existe em Dev mode)
      const auth = req.headers.authorization ?? "";
      if (!auth.startsWith(`Bearer ${DEV_PREFIX}`)) return fail(res, 401, "Unauthorized");

      if (req.method === "POST" && path === "/v2/transparents/create") {
        calls.create++;
        if (config.failCreate) return fail(res, Number(config.failCreate), "Internal server error");
        const body = await readBody(req);
        const d = body?.data ?? {};
        if (body?.method !== "PIX" || !Number.isInteger(d.amount) || d.amount < 100) return fail(res, 400, "Invalid body");
        const c = newCharge({ amount: d.amount, expiresIn: Number(d.expiresIn) || 3600, externalId: typeof d.externalId === "string" ? d.externalId : null, metadata: d.metadata ?? {} });
        if (config.failCreateAfterCreate) return fail(res, Number(config.failCreateAfterCreate), "Internal server error"); // criou, mas a resposta se perdeu
        return ok(res, apiView(c));
      }
      if (req.method === "GET" && path === "/v2/transparents/check") {
        calls.check++;
        const c = charges.get(u.searchParams.get("id") ?? "");
        if (!c) return fail(res, 404, "Not found");
        return ok(res, { status: c.status, expiresAt: c.expiresAt }); // forma mínima documentada (sem amount/devMode)
      }
      if (req.method === "GET" && path === "/v2/transparents/list") {
        calls.list++;
        const limit = Math.min(Math.max(Number(u.searchParams.get("limit")) || 20, 1), 100, Number(config.maxPageSize) || 100);
        const startDate = u.searchParams.get("startDate"), after = u.searchParams.get("after");
        const id = u.searchParams.get("id"), ext = u.searchParams.get("externalId");
        const since = startDate ? Date.parse(`${startDate}T00:00:00-03:00`) : -Infinity; // fuso de São Paulo, como a doc
        let all = [...charges.values()].sort((a, b) => b.seq - a.seq).filter((c) => Date.parse(c.createdAt) >= since);
        if (config.honorUndocumentedFilters) all = all.filter((c) => (!id || c.id === id) && (!ext || c.externalId === ext));
        let start = 0;
        if (after) { const i = all.findIndex((c) => c.id === after); start = i < 0 ? all.length : i + 1; }
        const pageItems = all.slice(start, start + limit);
        const hasMore = start + limit < all.length;
        return send(res, 200, {
          data: pageItems.map(apiView), success: true, error: null,
          pagination: { hasMore, next: hasMore ? pageItems[pageItems.length - 1].id : null, before: start > 0 ? pageItems[0]?.id ?? null : null },
        });
      }
      if (req.method === "GET" && path === "/v2/transparents/get") {
        calls.get++;
        const c = charges.get(u.searchParams.get("id") ?? "");
        if (!c) return fail(res, 404, "Not found");
        return ok(res, apiView(c));
      }
      if (req.method === "POST" && path === "/v2/transparents/refund") {
        calls.refund++;
        const body = await readBody(req);
        const c = charges.get(body?.id ?? "");
        if (!c) return fail(res, 404, "Not found");
        if (c.status === "REFUNDED") return fail(res, 400, ALREADY_REFUNDED);
        if (c.status !== "PAID") return fail(res, 400, "TRANSACTION_NOT_REFUNDABLE");
        c.status = "REFUNDED"; c.updatedAt = new Date().toISOString();
        if (config.deliverWebhooks) await deliver(c, { event: "transparent.refunded" });
        return ok(res, { id: `tran_fake_${randomBytes(6).toString("hex")}`, status: "COMPLETE", amount: c.amount, reason: body.reason ?? null, originalId: c.id });
      }
      if (req.method === "POST" && path === "/v2/transparents/simulate-payment") {
        calls.simulate++;
        const c = charges.get(u.searchParams.get("id") ?? "");
        if (!c) return fail(res, 404, "Not found");
        if (c.status !== "PENDING") return fail(res, 400, "Not pending");
        c.status = "PAID"; c.updatedAt = new Date().toISOString();
        if (config.deliverWebhooks) await deliver(c, { event: "transparent.completed" });
        return ok(res, view(c));
      }
      return fail(res, 404, "Not found");
    } catch {
      return fail(res, 500, "Internal server error");
    }
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const addr = server.address();
      resolve({
        port: typeof addr === "object" && addr ? addr.port : port,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function loadEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const env = { ...(process.env.FAKE_ABACATEPAY_ENV_FILE ? loadEnvFile(process.env.FAKE_ABACATEPAY_ENV_FILE) : {}), ...process.env };
  const port = Number(env.FAKE_ABACATEPAY_PORT || 56490);
  const webhookUrl = env.FAKE_ABACATEPAY_WEBHOOK_URL
    || `http://127.0.0.1:56421/functions/v1/payments-webhook?webhookSecret=${encodeURIComponent(env.ABACATEPAY_WEBHOOK_SECRET ?? "")}`;
  if (!env.ABACATEPAY_HMAC_KEY) { console.error("defina ABACATEPAY_HMAC_KEY (o mesmo valor das funções)"); process.exit(1); }
  const s = await startFakeAbacatePay({ port, webhookUrl, hmacKey: env.ABACATEPAY_HMAC_KEY });
  console.log(`fake AbacatePay em http://127.0.0.1:${s.port}/v2`);
}
