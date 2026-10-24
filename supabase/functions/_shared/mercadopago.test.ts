// Testes do cliente puro do Mercado Pago com fetch injetado (nenhuma rede). Valores fictícios.
import { describe, expect, it } from "vitest";
import {
  createPreference, getMe, getPayment, MercadoPagoError, normalizePayment, refundIdempotencyKey, refundPayment, searchPayments,
  searchPreferences, type MercadoPagoConfig,
} from "./mercadopago";

const TOKEN = "TOKEN-FICTICIO-DE-TESTE";
type Call = { url: string; init: RequestInit };
function mk(responder: (c: Call) => Response | Promise<Response>, extra: Partial<MercadoPagoConfig> = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const c = { url, init };
    calls.push(c);
    return responder(c);
  }) as unknown as typeof fetch;
  return { cfg: { accessToken: TOKEN, baseUrl: "https://mp.test", fetchImpl, ...extra } as MercadoPagoConfig, calls };
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const hdr = (c: Call, k: string) => (c.init.headers as Record<string, string>)[k];

describe("createPreference", () => {
  const input = {
    orderId: "11111111-1111-4111-8111-111111111111", eventId: "22222222-2222-4222-8222-222222222222", planCode: "festa", title: "MemoriesMT - plano Festa",
    amountCents: 2900, notificationUrl: "https://x.test/functions/v1/payments-webhook",
    backUrls: { success: "https://app.test/ok", pending: "https://app.test/p", failure: "https://app.test/f" },
    expiresAt: "2026-10-23T13:00:00.000Z", now: "2026-10-23T12:00:00.000Z",
  };
  it("envia os campos documentados e devolve id e init_point", async () => {
    const { cfg, calls } = mk(() => json({ id: "pref-1", init_point: "https://mp.test/checkout?pref_id=pref-1", sandbox_init_point: "https://mp.test/sbx", collector_id: 900, expiration_date_to: input.expiresAt }, 201));
    const r = await createPreference(cfg, input);
    expect(r).toEqual({ id: "pref-1", initPoint: "https://mp.test/checkout?pref_id=pref-1", collectorId: "900", expirationDateTo: input.expiresAt });
    expect(calls[0].url).toBe("https://mp.test/checkout/preferences");
    expect(calls[0].init.method).toBe("POST");
    expect(hdr(calls[0], "Authorization")).toBe(`Bearer ${TOKEN}`);
    const b = JSON.parse(String(calls[0].init.body));
    expect(b).toMatchObject({
      external_reference: input.orderId, notification_url: input.notificationUrl, auto_return: "approved", expires: true,
      expiration_date_to: input.expiresAt, expiration_date_from: input.now, back_urls: input.backUrls,
      metadata: { order_id: input.orderId, event_id: input.eventId, plan_code: "festa" },
    });
    expect(b.items).toEqual([{ id: "festa", title: input.title, quantity: 1, currency_id: "BRL", unit_price: 29 }]);
    expect(b.payer).toBeUndefined();
  });
  it("preço em reais com duas casas a partir dos centavos", async () => {
    const { cfg, calls } = mk(() => json({ id: "p", init_point: "https://mp.test/x" }, 201));
    await createPreference(cfg, { ...input, amountCents: 18905 });
    expect(JSON.parse(String(calls[0].init.body)).items[0].unit_price).toBe(189.05);
  });
  it("resposta sem id ou init_point é erro tipado bad_response", async () => {
    for (const body of [{ id: "p" }, { init_point: "https://mp.test/x" }, {}]) {
      const { cfg } = mk(() => json(body, 201));
      await expect(createPreference(cfg, input)).rejects.toMatchObject({ name: "MercadoPagoError", kind: "bad_response" });
    }
  });
  it("init_point precisa ser https", async () => {
    const { cfg } = mk(() => json({ id: "p", init_point: "http://mp.test/x" }, 201));
    await expect(createPreference(cfg, input)).rejects.toMatchObject({ kind: "bad_response" });
  });
});

describe("erros tipados", () => {
  const cases: Array<[number, string]> = [[401, "auth"], [403, "permission"], [404, "invalid"], [400, "invalid"], [409, "invalid"], [429, "rate_limit"], [500, "provider"], [503, "provider"]];
  for (const [status, kind] of cases) {
    it(`HTTP ${status} → ${kind}, sem token nem corpo na mensagem`, async () => {
      const { cfg } = mk(() => json({ message: `segredo ${TOKEN} vazou`, error: "algum_codigo", status }, status));
      const e = await getPayment(cfg, "123").catch((x) => x);
      expect(e).toBeInstanceOf(MercadoPagoError);
      expect(e.kind).toBe(kind);
      expect(e.status).toBe(status);
      expect(e.message).not.toContain(TOKEN);
      expect(e.message).not.toContain("vazou");
    });
  }
  it("código do provedor só quando tem forma de constante", async () => {
    const { cfg } = mk(() => json({ error: "idempotency_key_already_used", message: "texto livre" }, 409));
    const e = await getPayment(cfg, "1").catch((x) => x);
    expect(e.providerCode).toBe("idempotency_key_already_used");
    const { cfg: c2 } = mk(() => json({ error: "Texto Livre Com Espaços" }, 400));
    expect((await getPayment(c2, "1").catch((x) => x)).providerCode).toBeUndefined();
  });
  it("falha de rede → network; tempo esgotado → timeout; corpo não-JSON em 200 → bad_response", async () => {
    const net = mk(() => { throw new Error(`falha com ${TOKEN}`); });
    const e1 = await getPayment(net.cfg, "1").catch((x) => x);
    expect(e1).toMatchObject({ kind: "network", status: 0 });
    expect(e1.message).not.toContain(TOKEN);
    const slow = mk((c) => new Promise<Response>((_, rej) => (c.init.signal as AbortSignal).addEventListener("abort", () => rej(new Error("abort")))), { timeoutMs: 20 });
    expect(await getPayment(slow.cfg, "1").catch((x) => x)).toMatchObject({ kind: "timeout", status: 0 });
    const bad = mk(() => new Response("<html>", { status: 200 }));
    expect(await getPayment(bad.cfg, "1").catch((x) => x)).toMatchObject({ kind: "bad_response" });
  });
  it("id de pagamento inválido é recusado localmente (sem chamada)", async () => {
    const { cfg, calls } = mk(() => json({}));
    await expect(getPayment(cfg, "../users/me")).rejects.toMatchObject({ kind: "invalid" });
    expect(calls).toHaveLength(0);
  });
});

describe("getPayment / normalizePayment", () => {
  const raw = {
    id: 987654321, status: "approved", status_detail: "accredited", transaction_amount: 29, currency_id: "BRL", live_mode: false,
    collector_id: 900, external_reference: "ref-1", payment_method_id: "pix", date_last_updated: "2026-10-23T12:03:00.000-03:00",
    transaction_amount_refunded: 0, payer: { email: "nao@usar.test" },
  };
  it("normaliza valores em centavos, ids como texto e descarta o pagador", async () => {
    const { cfg, calls } = mk(() => json(raw));
    const p = await getPayment(cfg, "987654321");
    expect(calls[0].url).toBe("https://mp.test/v1/payments/987654321");
    expect(p).toEqual({
      id: "987654321", status: "approved", amountCents: 2900, currency: "BRL", liveMode: false, collectorId: "900", externalReference: "ref-1",
      method: "pix", updatedAt: "2026-10-23T15:03:00.000Z", refundedCents: 0,
    });
    expect(JSON.stringify(p)).not.toContain("nao@usar.test");
  });
  it("arredonda sem erro de ponto flutuante e trata campos ausentes", () => {
    expect(normalizePayment({ ...raw, transaction_amount: 18.9 }).amountCents).toBe(1890);
    expect(normalizePayment({ ...raw, transaction_amount: 0.29 }).amountCents).toBe(29);
    expect(normalizePayment({ ...raw, transaction_amount_refunded: 10.1 }).refundedCents).toBe(1010);
    const n = normalizePayment({ id: 1, status: "pending" });
    expect(n).toMatchObject({ id: "1", amountCents: null, currency: null, liveMode: null, collectorId: null, externalReference: null, updatedAt: null, refundedCents: 0 });
    expect(normalizePayment({ ...raw, live_mode: "true" }).liveMode).toBeNull(); // só booleano de verdade
  });
  it("sem id ou status é bad_response", async () => {
    const { cfg } = mk(() => json({ status: "approved" }));
    await expect(getPayment(cfg, "1")).rejects.toMatchObject({ kind: "bad_response" });
  });
});

describe("searchPayments", () => {
  it("filtra por external_reference com limit/offset/sort e devolve paginação", async () => {
    const { cfg, calls } = mk(() => json({ paging: { total: 3, limit: 2, offset: 0 }, results: [{ id: 1, status: "approved" }, { id: 2, status: "pending" }] }));
    const r = await searchPayments(cfg, { externalReference: "ref 1", limit: 2, offset: 0 });
    const u = new URL(calls[0].url);
    expect(u.pathname).toBe("/v1/payments/search");
    expect(u.searchParams.get("external_reference")).toBe("ref 1");
    expect(u.searchParams.get("limit")).toBe("2");
    expect(u.searchParams.get("offset")).toBe("0");
    expect(u.searchParams.get("sort")).toBe("date_last_updated");
    expect(u.searchParams.get("criteria")).toBe("asc");
    expect(r.total).toBe(3);
    expect(r.results.map((p) => p.id)).toEqual(["1", "2"]);
  });
  it("limit é limitado a 50 (máximo documentado) e resultados inválidos são descartados", async () => {
    const { cfg, calls } = mk(() => json({ paging: { total: 2 }, results: [{ id: 1, status: "approved" }, { nada: true }] }));
    const r = await searchPayments(cfg, { externalReference: "r", limit: 500, offset: 0 });
    expect(new URL(calls[0].url).searchParams.get("limit")).toBe("50");
    expect(r.results).toHaveLength(1);
  });
});

describe("refundPayment", () => {
  it("total: sem corpo de valor, com X-Idempotency-Key e X-Render-In-Process-Refunds", async () => {
    const { cfg, calls } = mk(() => json({ id: 77, payment_id: 5, amount: 29, status: "approved" }, 201));
    const r = await refundPayment(cfg, "5", { idempotencyKey: "chave-1" });
    expect(r).toEqual({ id: "77", status: "approved", amountCents: 2900 });
    expect(calls[0].url).toBe("https://mp.test/v1/payments/5/refunds");
    expect(hdr(calls[0], "X-Idempotency-Key")).toBe("chave-1");
    expect(hdr(calls[0], "X-Render-In-Process-Refunds")).toBe("true");
    expect(JSON.parse(String(calls[0].init.body ?? "{}"))).toEqual({});
  });
  it("parcial: amount em reais", async () => {
    const { cfg, calls } = mk(() => json({ id: 78, amount: 10.5, status: "approved" }, 201));
    await refundPayment(cfg, "5", { idempotencyKey: "chave-2", amountCents: 1050 });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ amount: 10.5 });
  });
  it("Pix em processamento (in_process) é sucesso; 409 de chave reutilizada é erro tipado", async () => {
    const { cfg } = mk(() => json({ id: 79, amount: 29, status: "in_process" }, 201));
    expect((await refundPayment(cfg, "5", { idempotencyKey: "k" })).status).toBe("in_process");
    const c2 = mk(() => json({ error: "idempotency_key_already_used" }, 409));
    expect(await refundPayment(c2.cfg, "5", { idempotencyKey: "k" }).catch((x) => x)).toMatchObject({ kind: "invalid", status: 409, providerCode: "idempotency_key_already_used" });
  });
  it("chave de idempotência vazia ou maior que 64 é recusada localmente", async () => {
    const { cfg, calls } = mk(() => json({}));
    await expect(refundPayment(cfg, "5", { idempotencyKey: "" })).rejects.toMatchObject({ kind: "invalid" });
    await expect(refundPayment(cfg, "5", { idempotencyKey: "x".repeat(65) })).rejects.toMatchObject({ kind: "invalid" });
    expect(calls).toHaveLength(0);
  });
});

describe("refundIdempotencyKey", () => {
  it("é estável por solicitação, diferente entre solicitações e cabe em 64 caracteres", async () => {
    const a = await refundIdempotencyKey("o1", "p1", "2026-10-23T12:00:00Z", null);
    expect(a).toBe(await refundIdempotencyKey("o1", "p1", "2026-10-23T12:00:00Z", null));
    expect(a).not.toBe(await refundIdempotencyKey("o1", "p1", "2026-10-23T12:01:00Z", null));
    expect(a).not.toBe(await refundIdempotencyKey("o1", "p1", "2026-10-23T12:00:00Z", 1000));
    expect(a).not.toBe(await refundIdempotencyKey("o1", "p2", "2026-10-23T12:00:00Z", null));
    expect(a.length).toBeLessThanOrEqual(64);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("getMe / searchPreferences (diagnóstico)", () => {
  it("getMe devolve só metadados não secretos", async () => {
    const { cfg, calls } = mk(() => json({ id: 900, nickname: "LOJA", site_id: "MLB", country_id: "BR", email: "x@y.test", first_name: "N" }));
    const me = await getMe(cfg);
    expect(calls[0].url).toBe("https://mp.test/users/me");
    expect(me).toEqual({ id: "900", siteId: "MLB", countryId: "BR" });
  });
  it("getMe sem id é bad_response", async () => {
    const { cfg } = mk(() => json({ nickname: "x" }));
    await expect(getMe(cfg)).rejects.toMatchObject({ kind: "bad_response" });
  });
  it("searchPreferences usa limit=1 e devolve o total", async () => {
    const { cfg, calls } = mk(() => json({ paging: { total: 4 }, elements: [{ id: "a" }] }));
    expect(await searchPreferences(cfg, 1)).toEqual({ total: 4 });
    expect(new URL(calls[0].url).pathname).toBe("/checkout/preferences/search");
    expect(new URL(calls[0].url).searchParams.get("limit")).toBe("1");
  });
});
