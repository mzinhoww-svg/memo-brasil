// Testes puros (sem rede) do cliente AbacatePay v2, da autenticação do webhook e do mapa de status.
// Rodar: cd web && npx vitest run --config vitest.functions.config.ts
import { describe, expect, it } from "vitest";
import { AbacateError, checkPixCharge, createPixCharge, getPixCharge, listPixCharges, refundCharge, simulatePixPayment, type AbacateConfig } from "./abacatepay";
import { verifyWebhookRequest } from "./payments-webhook-auth";
import { chargeMatchesOrder, findChargeForOrder, mapProviderStatus, refundBlocker } from "./payments-status";

// Chaves fictícias, só para teste (nunca chaves reais).
const DEV_KEY = "abc_dev_TESTE_fake_0000000000";
const PROD_KEY = "abc_prod_TESTE_fake_1111111111";
const BASE = "https://api.abacatepay.test/v2";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function fakeFetch(status: number, body: unknown, calls: Call[] = []): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    calls.push({ url: String(input), method: init?.method ?? "GET", headers, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status, headers: { "content-type": "application/json" } }));
  }) as typeof fetch;
}

const cfg = (fetchImpl: typeof fetch, apiKey = DEV_KEY): AbacateConfig => ({ apiKey, baseUrl: BASE, fetchImpl });

const pixData = {
  id: "pix_char_abc123xyz",
  amount: 2900,
  status: "PENDING",
  devMode: true,
  brCode: "00020160014BR.GOV.BCB.PIX070503***6304ABCD",
  brCodeBase64: "data:image/png;base64,iVBORw0KG...",
  platformFee: 80,
  receiptUrl: null,
  createdAt: "2026-10-22T12:00:00.000Z",
  updatedAt: "2026-10-22T12:00:00.000Z",
  expiresAt: "2026-10-22T12:30:00.000Z",
  metadata: { orderId: "o-1" },
};
const ok = (data: unknown) => ({ data, success: true, error: null });

async function caught(p: Promise<unknown>): Promise<AbacateError> {
  try {
    await p;
  } catch (e) {
    return e as AbacateError;
  }
  throw new Error("esperava erro");
}

describe("createPixCharge", () => {
  it("envia method PIX, amount em centavos, expiresIn 1800, sem customer, com Authorization Bearer", async () => {
    const calls: Call[] = [];
    const r = await createPixCharge(cfg(fakeFetch(200, ok(pixData), calls)), {
      amountCents: 2900,
      expiresInSec: 1800,
      description: "MemoriesMT - plano Festa",
      externalId: "o-1",
      metadata: { orderId: "o-1", eventId: "e-1" },
    });
    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(c.url).toBe(`${BASE}/transparents/create`);
    expect(c.method).toBe("POST");
    expect(c.headers["authorization"]).toBe(`Bearer ${DEV_KEY}`);
    expect(c.headers["content-type"]).toBe("application/json");
    expect(c.body).toEqual({
      method: "PIX",
      data: { amount: 2900, expiresIn: 1800, description: "MemoriesMT - plano Festa", externalId: "o-1", metadata: { orderId: "o-1", eventId: "e-1" } },
    });
    expect((c.body as { data: Record<string, unknown> }).data).not.toHaveProperty("customer");
    expect(r).toEqual({ id: pixData.id, status: "PENDING", brCode: pixData.brCode, brCodeBase64: pixData.brCodeBase64, expiresAt: pixData.expiresAt, devMode: true, amount: 2900 });
  });

  it("aceita baseUrl com barra final sem duplicar a barra", async () => {
    const calls: Call[] = [];
    await createPixCharge({ apiKey: DEV_KEY, baseUrl: `${BASE}/`, fetchImpl: fakeFetch(200, ok(pixData), calls) }, { amountCents: 2900, expiresInSec: 1800, description: "x", externalId: "o-1", metadata: {} });
    expect(calls[0].url).toBe(`${BASE}/transparents/create`);
  });

  it("recusa localmente (kind invalid, sem chamar a rede) valor abaixo de 100 centavos ou não inteiro", async () => {
    const calls: Call[] = [];
    for (const amountCents of [99, 0, -100, 100.5, Number.NaN]) {
      const e = await caught(createPixCharge(cfg(fakeFetch(200, ok(pixData), calls)), { amountCents, expiresInSec: 1800, description: "x", externalId: "o", metadata: {} }));
      expect(e).toBeInstanceOf(AbacateError);
      expect(e.kind).toBe("invalid");
    }
    expect(calls).toHaveLength(0);
  });

  it("resposta sem campos obrigatórios vira erro provider", async () => {
    const e = await caught(createPixCharge(cfg(fakeFetch(200, ok({ id: "pix_char_x", status: "PENDING" }))), { amountCents: 2900, expiresInSec: 1800, description: "x", externalId: "o", metadata: {} }));
    expect(e.kind).toBe("provider");
  });
});

describe("erros do provedor", () => {
  const input = { amountCents: 2900, expiresInSec: 1800, description: "x", externalId: "o", metadata: {} };

  it("lança AbacateError kind 'auth' em 401 e 'permission' em 403 e 'rate_limit' em 429 sem conter a chave na mensagem", async () => {
    const cases: Array<[number, string]> = [
      [401, "auth"],
      [403, "permission"],
      [429, "rate_limit"],
    ];
    for (const [status, kind] of cases) {
      const body = { data: null, success: false, error: `segredo vazado ${DEV_KEY} corpo-bruto-xyz` };
      const e = await caught(createPixCharge(cfg(fakeFetch(status, body)), input));
      expect(e).toBeInstanceOf(AbacateError);
      expect(e.kind).toBe(kind);
      expect(e.status).toBe(status);
      const dump = `${e.message} ${e.stack ?? ""} ${JSON.stringify(e)} ${String(e)}`;
      expect(dump).not.toContain(DEV_KEY);
      expect(dump).not.toContain("corpo-bruto-xyz");
    }
  });

  it("trata success:false com HTTP 200 como erro provider", async () => {
    const e = await caught(createPixCharge(cfg(fakeFetch(200, { data: null, success: false, error: "Falha qualquer" })), input));
    expect(e).toBeInstanceOf(AbacateError);
    expect(e.kind).toBe("provider");
    expect(e.status).toBe(200);
  });

  it("5xx e corpo que não é JSON viram provider; 400/422 viram invalid", async () => {
    expect((await caught(createPixCharge(cfg(fakeFetch(502, "<html>bad gateway</html>")), input))).kind).toBe("provider");
    expect((await caught(createPixCharge(cfg(fakeFetch(200, "não é json")), input))).kind).toBe("provider");
    expect((await caught(createPixCharge(cfg(fakeFetch(400, { data: null, success: false, error: "x" })), input))).kind).toBe("invalid");
    expect((await caught(createPixCharge(cfg(fakeFetch(422, { data: null, success: false, error: "x" })), input))).kind).toBe("invalid");
  });

  it("falha de rede vira kind network sem vazar a chave", async () => {
    const boom = (() => Promise.reject(new TypeError(`fetch failed for ${DEV_KEY}`))) as typeof fetch;
    const e = await caught(createPixCharge(cfg(boom), input));
    expect(e.kind).toBe("network");
    expect(e.status).toBe(0);
    expect(`${e.message} ${JSON.stringify(e)}`).not.toContain(DEV_KEY);
  });

  it("expõe só um código de erro do provedor no formato CONSTANTE, nunca texto livre", async () => {
    const e1 = await caught(refundCharge(cfg(fakeFetch(400, { data: null, success: false, error: "TRANSACTION_NOT_REFUNDABLE" })), "pix_char_1", "motivo"));
    expect(e1.providerCode).toBe("TRANSACTION_NOT_REFUNDABLE");
    const e2 = await caught(refundCharge(cfg(fakeFetch(400, { data: null, success: false, error: "texto livre com dados" })), "pix_char_1", "motivo"));
    expect(e2.providerCode).toBeUndefined();
  });
});

describe("checkPixCharge", () => {
  it("faz GET /transparents/check?id= e devolve status", async () => {
    const calls: Call[] = [];
    const r = await checkPixCharge(cfg(fakeFetch(200, ok({ id: "pix_char_a/b", status: "PAID", devMode: true, amount: 2900, expiresAt: pixData.expiresAt }), calls)), "pix_char_a/b");
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe(`${BASE}/transparents/check?id=pix_char_a%2Fb`);
    expect(calls[0].headers["authorization"]).toBe(`Bearer ${DEV_KEY}`);
    expect(r).toEqual({ id: "pix_char_a/b", status: "PAID", devMode: true, amount: 2900, expiresAt: pixData.expiresAt });
  });

  it("sem devMode na resposta, deduz pelo prefixo da chave (o ambiente é definido pela chave)", async () => {
    const r1 = await checkPixCharge(cfg(fakeFetch(200, ok({ status: "PENDING" }))), "pix_char_1");
    expect(r1).toEqual({ id: "pix_char_1", status: "PENDING", devMode: true });
    const r2 = await checkPixCharge(cfg(fakeFetch(200, ok({ status: "PENDING" })), PROD_KEY), "pix_char_1");
    expect(r2.devMode).toBe(false);
  });

  it("sem status vira erro provider; id vazio é invalid", async () => {
    expect((await caught(checkPixCharge(cfg(fakeFetch(200, ok({ id: "x" }))), "x"))).kind).toBe("provider");
    expect((await caught(checkPixCharge(cfg(fakeFetch(200, ok({}))), ""))).kind).toBe("invalid");
  });
});

describe("listPixCharges (parâmetros documentados: limit, after, startDate, method, externalId)", () => {
  const page = (data: unknown[], next: string | null) => ({ data, success: true, error: null, pagination: { hasMore: next !== null, next, before: null } });

  it("faz GET /transparents/list com startDate/limit/after e devolve itens com externalId e o cursor seguinte", async () => {
    const calls: Call[] = [];
    const r = await listPixCharges(cfg(fakeFetch(200, page([{ ...pixData, externalId: "o-1" }], "pix_char_cursor"), calls)), { startDate: "2026-10-21", limit: 100, after: "pix_char_prev", externalId: "o-1" });
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe(`${BASE}/transparents/list?limit=100&startDate=2026-10-21&method=PIX&externalId=o-1&after=pix_char_prev`);
    expect(r).toEqual({
      items: [{ id: pixData.id, status: "PENDING", devMode: true, amount: 2900, externalId: "o-1", metadataOrderId: "o-1", brCode: pixData.brCode, brCodeBase64: pixData.brCodeBase64, expiresAt: pixData.expiresAt }],
      next: "pix_char_cursor",
    });
  });

  it("sem externalId não envia o filtro; nunca envia id; itens sem id ou status são descartados; fim da lista → next null", async () => {
    const calls: Call[] = [];
    const r = await listPixCharges(cfg(fakeFetch(200, page([{ id: "x" }, { status: "PAID" }, { id: "pix_char_2", status: "PAID", amount: 2900, externalId: null }], null), calls)), { startDate: "2026-10-01" });
    expect(calls[0].url).toBe(`${BASE}/transparents/list?limit=100&startDate=2026-10-01&method=PIX`);
    expect(calls[0].url).not.toMatch(/[?&]id=/);
    expect(r).toEqual({ items: [{ id: "pix_char_2", status: "PAID", devMode: true, amount: 2900 }], next: null });
  });

  it("startDate fora de YYYY-MM-DD é invalid sem rede; erro HTTP vira AbacateError", async () => {
    const calls: Call[] = [];
    expect((await caught(listPixCharges(cfg(fakeFetch(200, page([], null), calls)), { startDate: "21/10/2026" }))).kind).toBe("invalid");
    expect(calls).toHaveLength(0);
    expect((await caught(listPixCharges(cfg(fakeFetch(429, { data: null, success: false, error: "x" })), { startDate: "2026-10-21" }))).kind).toBe("rate_limit");
  });
});

describe("getPixCharge", () => {
  it("faz GET /transparents/get?id= e devolve status, valor, externalId e vencimento", async () => {
    const calls: Call[] = [];
    const r = await getPixCharge(cfg(fakeFetch(200, ok({ ...pixData, status: "PAID", externalId: "o-1" }), calls)), "pix_char_a/b");
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe(`${BASE}/transparents/get?id=pix_char_a%2Fb`);
    expect(r).toEqual({ id: pixData.id, status: "PAID", devMode: true, amount: 2900, externalId: "o-1", metadataOrderId: "o-1", brCode: pixData.brCode, brCodeBase64: pixData.brCodeBase64, expiresAt: pixData.expiresAt });
  });

  it("sem status vira provider; id vazio é invalid; sem externalId o campo fica ausente", async () => {
    expect((await caught(getPixCharge(cfg(fakeFetch(200, ok({ id: "x" }))), "x"))).kind).toBe("provider");
    expect((await caught(getPixCharge(cfg(fakeFetch(200, ok({}))), ""))).kind).toBe("invalid");
    expect(await getPixCharge(cfg(fakeFetch(200, ok({ status: "PENDING", amount: 100, externalId: null, metadata: null }))), "pix_1")).toEqual({ id: "pix_1", status: "PENDING", devMode: true, amount: 100 });
    // sem externalId (a doc não o garante no PIX): a identidade vem de metadata.orderId
    expect(await getPixCharge(cfg(fakeFetch(200, ok({ status: "PAID", amount: 100, metadata: { orderId: "o-9", eventId: "e" } }))), "pix_2")).toEqual({ id: "pix_2", status: "PAID", devMode: true, amount: 100, metadataOrderId: "o-9" });
  });
});

describe("refundCharge", () => {
  it("faz POST /transparents/refund com {id, reason}", async () => {
    const calls: Call[] = [];
    await refundCharge(cfg(fakeFetch(200, ok({ id: "tran_1", status: "COMPLETE", amount: 2900, reason: "r", originalId: "pix_char_1" }), calls)), "pix_char_1", "Pedido do Master");
    expect(calls[0].url).toBe(`${BASE}/transparents/refund`);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ id: "pix_char_1", reason: "Pedido do Master" });
  });

  it("cobrança já reembolsada (HTTP 400 documentado) é tratada como sucesso idempotente", async () => {
    await expect(refundCharge(cfg(fakeFetch(400, { data: null, success: false, error: "Esta cobrança já foi reembolsada." })), "pix_char_1", "r")).resolves.toBeUndefined();
  });
});

describe("simulatePixPayment", () => {
  it("simulatePixPayment recusa chave abc_prod_ sem chamar a rede", async () => {
    const calls: Call[] = [];
    const e = await caught(simulatePixPayment(cfg(fakeFetch(200, ok({}), calls), PROD_KEY), "pix_char_1"));
    expect(e).toBeInstanceOf(AbacateError);
    expect(e.kind).toBe("invalid");
    expect(e.message).not.toContain(PROD_KEY);
    expect(calls).toHaveLength(0);
  });

  it("com chave abc_dev_ faz POST /transparents/simulate-payment?id=", async () => {
    const calls: Call[] = [];
    await simulatePixPayment(cfg(fakeFetch(200, ok({ id: "pix_char_1", status: "PAID", devMode: true }), calls)), "pix_char_1");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe(`${BASE}/transparents/simulate-payment?id=pix_char_1`);
    expect(calls[0].headers["authorization"]).toBe(`Bearer ${DEV_KEY}`);
  });
});

// ---------------- Webhook ----------------

async function sign(key: string, body: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)));
  return btoa(String.fromCharCode(...mac));
}

describe("verifyWebhookRequest", () => {
  // Chave e segredo gerados no teste (não são os valores reais).
  const hmacKey = `teste-${crypto.randomUUID()}`;
  const secret = `whsec-${crypto.randomUUID()}`;
  const rawBody = JSON.stringify({ id: "log_1", event: "transparent.completed", apiVersion: 2, devMode: true, data: { transparent: { id: "pix_char_1", status: "PAID", amount: 2900 } } });
  const url = (s: string) => `https://x.supabase.co/functions/v1/payments-webhook?webhookSecret=${encodeURIComponent(s)}`;

  it("verifyWebhookRequest aceita corpo assinado com a chave publicada e segredo correto", async () => {
    const sig = await sign(hmacKey, rawBody);
    expect(await verifyWebhookRequest({ url: url(secret), rawBody, signatureHeader: sig, expectedSecret: secret, hmacKey })).toBe(true);
  });

  it("aceita corpo com caracteres não ASCII (HMAC sobre os bytes UTF-8 do corpo bruto)", async () => {
    const body = JSON.stringify({ id: "log_2", data: { nome: "Celebração ação" } });
    expect(await verifyWebhookRequest({ url: url(secret), rawBody: body, signatureHeader: await sign(hmacKey, body), expectedSecret: secret, hmacKey })).toBe(true);
  });

  it("recusa segredo errado", async () => {
    const sig = await sign(hmacKey, rawBody);
    expect(await verifyWebhookRequest({ url: url("outro-segredo"), rawBody, signatureHeader: sig, expectedSecret: secret, hmacKey })).toBe(false);
    expect(await verifyWebhookRequest({ url: url(`${secret}x`), rawBody, signatureHeader: sig, expectedSecret: secret, hmacKey })).toBe(false);
    expect(await verifyWebhookRequest({ url: "https://x.supabase.co/functions/v1/payments-webhook", rawBody, signatureHeader: sig, expectedSecret: secret, hmacKey })).toBe(false);
  });

  it("recusa segredo esperado vazio (configuração ausente nunca autentica)", async () => {
    const sig = await sign(hmacKey, rawBody);
    expect(await verifyWebhookRequest({ url: url(""), rawBody, signatureHeader: sig, expectedSecret: "", hmacKey })).toBe(false);
  });

  it("recusa assinatura de outro corpo", async () => {
    const sig = await sign(hmacKey, `${rawBody} `);
    expect(await verifyWebhookRequest({ url: url(secret), rawBody, signatureHeader: sig, expectedSecret: secret, hmacKey })).toBe(false);
    const wrongKey = await sign("outra-chave", rawBody);
    expect(await verifyWebhookRequest({ url: url(secret), rawBody, signatureHeader: wrongKey, expectedSecret: secret, hmacKey })).toBe(false);
    expect(await verifyWebhookRequest({ url: url(secret), rawBody, signatureHeader: sig.slice(0, -2), expectedSecret: secret, hmacKey })).toBe(false);
  });

  it("recusa header ausente", async () => {
    expect(await verifyWebhookRequest({ url: url(secret), rawBody, signatureHeader: null, expectedSecret: secret, hmacKey })).toBe(false);
    expect(await verifyWebhookRequest({ url: url(secret), rawBody, signatureHeader: "", expectedSecret: secret, hmacKey })).toBe(false);
  });

  it("recusa URL malformada sem lançar", async () => {
    const sig = await sign(hmacKey, rawBody);
    expect(await verifyWebhookRequest({ url: "não é url", rawBody, signatureHeader: sig, expectedSecret: secret, hmacKey })).toBe(false);
  });
});

describe("mapProviderStatus", () => {
  it("segue a tabela 3.1", () => {
    expect(mapProviderStatus("PAID")).toBe("pago");
    expect(mapProviderStatus("APPROVED")).toBe("pago");
    expect(mapProviderStatus("PENDING")).toBe("pendente");
    expect(mapProviderStatus("EXPIRED")).toBe("expirado");
    expect(mapProviderStatus("CANCELLED")).toBe("cancelado");
    expect(mapProviderStatus("FAILED")).toBe("falhou");
    expect(mapProviderStatus("REFUNDED")).toBe("estornado");
    expect(mapProviderStatus("UNDER_DISPUTE")).toBe("em_disputa");
    expect(mapProviderStatus("XYZ")).toBe(null);
  });

  it("REDEEMED só é pago com valor 0; sem valor ou com valor > 0 é divergência (null)", () => {
    expect(mapProviderStatus("REDEEMED", 0)).toBe("pago");
    expect(mapProviderStatus("REDEEMED", 2900)).toBe(null);
    expect(mapProviderStatus("REDEEMED")).toBe(null);
  });

  it("não normaliza variações (minúsculas, espaços, nomes de propriedades do Object)", () => {
    for (const s of ["paid", " PAID", "", "toString", "__proto__", "constructor"]) expect(mapProviderStatus(s), s).toBe(null);
  });
});

describe("chargeMatchesOrder", () => {
  const order = { id: "aaaaaaaa-1111-4111-8111-11111111111b", amount_cents: 18900, provider_env: "sandbox" as const };
  it("só casa com externalId exato, mesmo valor e mesmo ambiente", () => {
    expect(chargeMatchesOrder({ externalId: order.id, amount: 18900, devMode: true }, order)).toBe(true);
    expect(chargeMatchesOrder({ externalId: order.id.toUpperCase(), amount: 18900, devMode: true }, order)).toBe(false);
    expect(chargeMatchesOrder({ externalId: "22222222-2222-4222-8222-222222222222", amount: 18900, devMode: true }, order)).toBe(false);
    expect(chargeMatchesOrder({ externalId: undefined, amount: 18900, devMode: true }, order)).toBe(false);
    expect(chargeMatchesOrder({ externalId: null, amount: 18900, devMode: true }, order)).toBe(false);
    expect(chargeMatchesOrder({ externalId: order.id, amount: 100, devMode: true }, order)).toBe(false);
    expect(chargeMatchesOrder({ externalId: order.id, devMode: true }, order)).toBe(false);
    expect(chargeMatchesOrder({ externalId: order.id, amount: 18900, devMode: false }, order)).toBe(false);
  });
  it("aceita a identidade por metadata.orderId quando não há externalId; metadata de outro pedido recusa", () => {
    expect(chargeMatchesOrder({ metadataOrderId: order.id, amount: 18900, devMode: true }, order)).toBe(true);
    expect(chargeMatchesOrder({ metadataOrderId: "22222222-2222-4222-8222-222222222222", amount: 18900, devMode: true }, order)).toBe(false);
    expect(chargeMatchesOrder({ metadataOrderId: order.id, amount: 100, devMode: true }, order)).toBe(false);
    expect(chargeMatchesOrder({ metadataOrderId: order.id, amount: 18900, devMode: false }, order)).toBe(false);
  });
});

describe("findChargeForOrder", () => {
  const order = { id: "aaaaaaaa-1111-4111-8111-11111111111b", amount_cents: 18900, provider_env: "sandbox" as const, created_at: "2026-10-22T12:00:00.000Z" };
  const page = (data: unknown[], next: string | null) => ({ data, success: true, error: null, pagination: { hasMore: next !== null, next, before: null } });
  function seq(pages: unknown[], calls: Call[]): typeof fetch {
    let i = 0;
    return ((input: RequestInfo | URL) => {
      calls.push({ url: String(input), method: "GET", headers: {}, body: undefined });
      const body = pages[Math.min(i++, pages.length - 1)];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }) as typeof fetch;
  }

  it("pagina com after e startDate (criação − 1 dia), filtra method/externalId e adota pela metadata na página 2", async () => {
    const calls: Call[] = [];
    const decoy = { id: "pix_d", status: "PENDING", amount: 18900, devMode: true, metadata: { orderId: "outro" } };
    const hit = { id: "pix_h", status: "PENDING", amount: 18900, devMode: true, metadata: { orderId: order.id } };
    const r = await findChargeForOrder(cfg(seq([page([decoy], "pix_d"), page([hit], null)], calls)), order);
    expect(r).toMatchObject({ complete: true, charge: { id: "pix_h", metadataOrderId: order.id } });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`${BASE}/transparents/list?limit=100&startDate=2026-10-21&method=PIX&externalId=${order.id}`);
    expect(calls[1].url).toContain("&after=pix_d");
  });

  it("para quando o cursor não avança (next igual ao after anterior) ou vem vazio", async () => {
    const calls: Call[] = [];
    const other = { id: "pix_o", status: "PENDING", amount: 18900, devMode: true, metadata: { orderId: "outro" } };
    const r = await findChargeForOrder(cfg(seq([page([other], "c1"), page([other], "c1"), page([other], "c1")], calls)), order);
    expect(r).toEqual({ charge: null, complete: false });
    expect(calls).toHaveLength(2);
    const calls2: Call[] = [];
    const r2 = await findChargeForOrder(cfg(seq([{ data: [other], success: true, error: null, pagination: { hasMore: true, next: "", before: null } }], calls2)), order);
    expect(r2).toEqual({ charge: null, complete: true });
    expect(calls2).toHaveLength(1);
  });
});

describe("refundBlocker (payments-refund, Ruling 16)", () => {
  const base = { id: "aaaaaaaa-1111-4111-8111-11111111111b", amount_cents: 18900, provider_env: "sandbox" as const, provider_charge_id: "pix_char_1",
                 refund_requested_at: "2026-10-22T10:00:00Z", needs_refund: false };
  const paid = { id: "pix_char_1", status: "PAID", externalId: base.id, amount: 18900, devMode: true };
  it("pago com reembolso solicitado e cobrança PAID que confere: liberado", () => {
    expect(refundBlocker({ ...base, status: "pago" }, paid)).toBeNull();
  });
  it("cancelado com needs_refund (Pix pago depois do cancelamento): liberado", () => {
    expect(refundBlocker({ ...base, status: "cancelado", needs_refund: true }, paid)).toBeNull();
  });
  it("cancelado sem needs_refund, em disputa, perdido ou estornado: estado_invalido", () => {
    for (const status of ["cancelado", "em_disputa", "perdido", "estornado", "pendente"] as const) {
      expect(refundBlocker({ ...base, status }, paid), status).toBe("estado_invalido");
    }
    expect(refundBlocker({ ...base, status: "perdido", needs_refund: true }, paid)).toBe("estado_invalido");
  });
  it("sem solicitação registrada ou sem cobrança", () => {
    expect(refundBlocker({ ...base, status: "pago", refund_requested_at: null }, paid)).toBe("reembolso_nao_solicitado");
    expect(refundBlocker({ ...base, status: "pago", provider_charge_id: null }, paid)).toBe("estado_invalido");
  });
  it("cobrança reconsultada precisa estar PAID e conferir com o pedido", () => {
    expect(refundBlocker({ ...base, status: "pago" }, { ...paid, status: "REFUNDED" })).toBe("cobranca_nao_paga");
    expect(refundBlocker({ ...base, status: "pago" }, { ...paid, status: "UNDER_DISPUTE" })).toBe("cobranca_nao_paga");
    expect(refundBlocker({ ...base, status: "pago" }, { ...paid, amount: 100 })).toBe("cobranca_nao_confere");
    expect(refundBlocker({ ...base, status: "pago" }, { ...paid, externalId: undefined })).toBe("cobranca_nao_confere");
    expect(refundBlocker({ ...base, status: "pago" }, { ...paid, devMode: false })).toBe("cobranca_nao_confere");
    expect(refundBlocker({ ...base, status: "pago" }, { ...paid, id: "pix_char_outra" })).toBe("cobranca_nao_confere");
  });
  it("sem a cobrança (antes da reconsulta) só confere o pedido", () => {
    expect(refundBlocker({ ...base, status: "pago" })).toBeNull();
  });
});
