import { describe, expect, it } from "vitest";
import { assertChargeOrder, resolveValidaPayEnvironment, ValidaPayClient, ValidaPayError, type ChargeInput } from "./validapay";

const buyer = { name: "Pessoa Teste", email: "test@example.test", documentNumber: "12345678901" };
const input: ChargeInput = { orderId: "11111111-1111-4111-8111-111111111111", amountCents: 18900, method: "pix", customer: buyer };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
type Call = { url: string; init: RequestInit };
function setup(reply: (call: Call) => Response | Promise<Response>, options: { now?: () => number; timeoutMs?: number; environment?: "sandbox" | "production"; mode?: "checkout" | "refund" | "refund-read" } = {}) {
  const calls: Call[] = [];
  const client = new ValidaPayClient({ environment: "sandbox", clientId: "test-id", clientSecret: "test-secret", ...options,
    fetchImpl: (async (url: string | URL | Request, init: RequestInit = {}) => {
      const call = { url: String(url), init }; calls.push(call);
      if (call.url.includes("/auth/token")) return json({ access_token: "test-access", expires_in: 3600, token_type: "Bearer" });
      return reply(call);
    }) as typeof fetch,
  });
  return { client, calls };
}

describe("ValidaPay checkout adapter (simulated transport, not homologation)", () => {
  it("refuses to bind a duplicate returned for a different merchant reference", () => {
    expect(() => assertChargeOrder({ merchantReference: "other-order" }, input.orderId)).toThrow();
    expect(() => assertChargeOrder({}, input.orderId)).toThrow();
    expect(() => assertChargeOrder({ merchantReference: input.orderId }, input.orderId)).not.toThrow();
  });
  it("converts cents once, sends stable externalId and allowlists buyer fields", async () => {
    const { client, calls } = setup(() => json({ success: true, chargeId: "cha_test", pix: { emv: "pix-copy" } }));
    const result = await client.createCharge({ ...input, customer: { ...buyer, cvv: "never-forward" } } as ChargeInput);
    const b = JSON.parse(String(calls[1].init.body));
    expect(calls[0].url).toBe("https://oauth2-sandbox.validapay.com.br/auth/token");
    expect(new URLSearchParams(String(calls[0].init.body)).get("scope")).toBe("checkouts/write charges/read charges/write");
    expect(calls[1].url).toBe("https://sandbox.validapay.com.br/v1/charges");
    expect(b).toEqual({ paymentMethod: "pix", externalId: input.orderId, externalTxid: input.orderId, amount: 189, customer: buyer });
    expect(result).toEqual({ chargeId: "cha_test", emv: "pix-copy", declined: false });
  });
  it("accepts the SANDBOX_cha_ prefix actually returned by the sandbox", async () => {
    const { client } = setup(() => json({ success: true, chargeId: "SANDBOX_cha_1793927390822_test" }));
    expect((await client.createCharge(input)).chargeId).toBe("SANDBOX_cha_1793927390822_test");
  });
  it("recovers charge identity from documented duplicate error without charging again", async () => {
    const { client } = setup(() => json({ error: { code: "DUPLICATE_CHARGE", details: { chargeId: "cha_existing" } } }, 409));
    expect(await client.createCharge(input)).toEqual({ chargeId: "cha_existing", declined: false });
  });
  it("preserves a declined charge identity for reconciliation, never treating it as paid", async () => {
    const { client } = setup(() => json({ success: false, status: "failed", chargeId: "cha_declined", error: "do not log buyer" }, 402));
    expect((await client.createCharge({ ...input, method: "card", cardToken: "ctk_test", deviceId: "22222222-2222-4222-8222-222222222222", authentication: { authenticationId: "auth", cardId: "card" } })).declined).toBe(true);
  });
  it("normalizes confirmed details and strips sensitive provider fields", async () => {
    const { client } = setup(() => json({ chargeId: "cha_test", status: "PAID", amount: 0.29, paidAmount: 0.29, currency: "BRL", paymentType: "PIX", customer: { document: "never-return" } }));
    expect(await client.getCharge("cha_test")).toEqual({ chargeId: "cha_test", status: "PAID", amountCents: 29, paidAmountCents: 29, currency: "BRL", environment: "sandbox", method: "pix" });
  });
  it("recognizes the CHARGE_FAILED state observed for a declined sandbox card", async () => {
    const { client } = setup(() => json({ chargeId: "SANDBOX_cha_declined", status: "CHARGE_FAILED", amount: 1.27, currency: "BRL", paymentType: "CREDIT_CARD" }));
    expect((await client.getCharge("SANDBOX_cha_declined")).status).toBe("CHARGE_FAILED");
  });
  it.each([
    { chargeId: "cha_other", amount: 189, currency: "BRL", status: "PAID", paymentType: "PIX" },
    { chargeId: "cha_test", amount: 189, currency: "USD", status: "PAID", paymentType: "PIX" },
    { chargeId: "cha_test", amount: 1.999, currency: "BRL", status: "PAID", paymentType: "PIX" },
    { chargeId: "cha_test", amount: 189, currency: "BRL", status: "MAGIC_SUCCESS", paymentType: "PIX" },
  ])("fails closed on invalid financial details %j", async (body) => {
    const { client } = setup(() => json(body));
    await expect(client.getCharge("cha_test")).rejects.toThrow();
  });
  it("coalesces parallel OAuth and caches tokens across calls", async () => {
    const { client, calls } = setup(() => json({ chargeId: "cha_test", status: "PENDING", amount: 189, currency: "BRL", paymentType: "PIX" }));
    await Promise.all([client.getCharge("cha_test"), client.getCharge("cha_test")]);
    expect(calls.filter((c) => c.url.includes("/auth/token"))).toHaveLength(1);
  });
  it("does not retry or leak provider bodies on failures", async () => {
    const { client, calls } = setup(() => json({ error: "secret buyer details" }, 500));
    await expect(client.createCharge(input)).rejects.toMatchObject({ name: "ValidaPayError", message: "validapay_http", status: 500 });
    expect(calls).toHaveLength(2);
    expect(ValidaPayError).toBeDefined();
  });
  it("rejects missing credentials and arbitrary environments without HTTP", () => {
    expect(() => new ValidaPayClient({ environment: "sandbox", clientId: "", clientSecret: "" })).toThrow();
    expect(() => new ValidaPayClient({ environment: "invalid" as "sandbox", clientId: "x", clientSecret: "y" })).toThrow();
  });
  it("rejects invalid card payloads before OAuth", async () => {
    const { client, calls } = setup(() => json({}));
    await expect(client.createCharge({ ...input, method: "card" })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it("requires 3DS evidence server-side even when a card token is valid", async () => {
    const { client, calls } = setup(() => json({ success: true, chargeId: "cha_test" }));
    await expect(client.createCharge({ ...input, method: "card", cardToken: "ctk_test", deviceId: "22222222-2222-4222-8222-222222222222" })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it("rejects non-UUID device IDs according to the official MCP contract", async () => {
    const { client, calls } = setup(() => json({ success: true, chargeId: "cha_test" }));
    await expect(client.createCharge({ ...input, method: "card", cardToken: "ctk_test", deviceId: "not-a-uuid", authentication: { authenticationId: "auth", cardId: "card" } })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it("uses the slim status route for polling, never grants a benefit from that response", async () => {
    const { client, calls } = setup(() => json({ chargeId: "cha_test", status: "PAID", amount: 189, paymentType: "PIX" }));
    expect(await client.getStatus("cha_test")).toEqual({ chargeId: "cha_test", status: "PAID" });
    expect(calls[1].url).toBe("https://sandbox.validapay.com.br/v1/charges/cha_test/status");
  });
  it("aborts a slow provider request with a sanitized timeout", async () => {
    const { client } = setup(({ init }) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("sensitive transport message")));
    }), { timeoutMs: 10 });
    await expect(client.createCharge(input)).rejects.toMatchObject({ kind: "timeout", message: "validapay_timeout" });
  });
  it("bounds the token cache by expires_in instead of assuming one hour", async () => {
    let now = 1000000;
    const { client, calls } = setup(() => json({ success: true, chargeId: "cha_test" }), { now: () => now });
    await client.createCharge(input);
    now += 3600001;
    await client.createCharge(input);
    expect(calls.filter((c) => c.url.includes("/auth/token"))).toHaveLength(2);
  });
  it("cancels only the selected charge using the documented DELETE endpoint", async () => {
    const { client, calls } = setup((c) => c.init.method === "DELETE" ? json({ chargeId: "cha_test" }) : json({ chargeId: "cha_test", status: "PENDING", amount: 189, currency: "BRL", paymentType: "PIX", externalTxid: input.orderId }));
    await client.cancelCharge("cha_test", input.orderId);
    expect(calls[2].url).toBe("https://sandbox.validapay.com.br/v1/charges/cha_test");
    expect(calls[2].init.method).toBe("DELETE");
  });
  it("never cancels a charge returned for another merchant reference", async () => {
    const { client, calls } = setup(() => json({ chargeId: "cha_test", status: "PENDING", amount: 189, currency: "BRL", paymentType: "PIX", externalTxid: "another-order" }));
    await expect(client.cancelCharge("cha_test", input.orderId)).rejects.toThrow();
    expect(calls.some((c) => c.init.method === "DELETE")).toBe(false);
  });
  it("verifies confirmed refunds for the exact merchant order", async () => {
    const { client } = setup((c) => c.url.includes('/wallet/refunds') ? json({ items: [
      { refundId: "ref_test", chargeId: "cha_test", amount: 189, status: "CONFIRMED", success: true },
    ] }) : json({ chargeId: "cha_test", status: "REFUNDED", amount: 189, currency: "BRL", paymentType: "CREDIT_CARD", externalTxid: input.orderId }), { mode: "refund" });
    expect(await client.getRefundEvidence("cha_test", input.orderId)).toMatchObject({ chargeId: "cha_test", refundedCents: 18900, amountCents: 18900, refundIds: ["ref_test"], merchantReference: input.orderId, environment: "sandbox" });
  });
  it("does not request a refund from a checkout-only client", async () => {
    const { client, calls } = setup(() => json({}));
    await expect(client.requestRefund("cha_test", input.orderId, 18900)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it("rejects a refund returned for another charge", async () => {
    const { client } = setup((c) => c.url.includes('/wallet/refunds') ? json({ items: [
      { refundId: "ref_foreign", chargeId: "cha_other", amount: 189, status: "CONFIRMED", success: true },
    ] }) : json({ chargeId: "cha_test", status: "PAID", amount: 189, currency: "BRL", paymentType: "CREDIT_CARD", externalTxid: input.orderId }), { mode: "refund" });
    await expect(client.getRefundEvidence("cha_test", input.orderId)).rejects.toThrow();
  });
  it("does not count pending refunds as returned money", async () => {
    const { client } = setup((c) => c.url.includes('/wallet/refunds') ? json({ items: [
      { refundId: "ref_pending", chargeId: "cha_test", amount: 189, status: "PROCESSING", success: false },
    ] }) : json({ chargeId: "cha_test", status: "PAID", amount: 189, currency: "BRL", paymentType: "CREDIT_CARD", externalTxid: input.orderId }), { mode: "refund" });
    expect((await client.getRefundEvidence("cha_test", input.orderId)).refundedCents).toBe(0);
  });
  it("never refunds more than the amount reserved by the database", async () => {
    const { client, calls } = setup(() => json({ chargeId: "cha_test", status: "PAID", amount: 200, paidAmount: 200, currency: "BRL", paymentType: "CREDIT_CARD", externalTxid: input.orderId }), { mode: "refund" });
    await expect(client.requestRefund("cha_test", input.orderId, 18900)).rejects.toThrow();
    expect(calls.some((c) => c.url.includes('/wallet/refunds') && c.init.method === 'POST')).toBe(false);
  });
  it("allows a separate bounded OAuth timeout without increasing charge timeouts", async () => {
    const client = new ValidaPayClient({ environment: "sandbox", clientId: "test", clientSecret: "test", timeoutMs: 5, oauthTimeoutMs: 100,
      fetchImpl: (async (url: string | URL | Request, init: RequestInit) => {
        if (String(url).includes('/auth/token')) return new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(json({ access_token: "token", expires_in: 3600 })), 20);
          init.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); });
        });
        return json({ success: true, chargeId: "cha_test" });
      }) as typeof fetch,
    });
    expect((await client.createCharge(input)).chargeId).toBe("cha_test");
  });
});

describe("production isolation (simulated transport)", () => {
  it("uses production endpoints and rejects sandbox charge IDs before transport", async () => {
    const { client, calls } = setup(() => json({ chargeId: "cha_prod", status: "PAID", amount: 1, paidAmount: 1, currency: "BRL", paymentType: "CREDIT_CARD", externalTxid: input.orderId }), { environment: "production" });
    await expect(client.getCharge("SANDBOX_cha_wrong")).rejects.toThrow();
    expect(calls).toHaveLength(0);
    expect((await client.getCharge("cha_prod")).environment).toBe("production");
    expect(calls[0].url).toBe("https://oauth2.validapay.com.br/auth/token");
    expect(calls[1].url).toBe("https://api.validapay.com.br/v1/charges/cha_prod");
  });
  it("allows production refund readback with read scopes but never financial refund POST", async () => {
    const { client, calls } = setup((call) => json(call.url.includes("/wallet/refunds?") ? { items: [] } : { chargeId: "cha_prod", status: "PAID", amount: 1, paidAmount: 1, currency: "BRL", paymentType: "CREDIT_CARD", externalTxid: input.orderId }), { environment: "production", mode: "refund-read" });
    await expect(client.requestRefund("cha_prod", input.orderId, 100)).rejects.toThrow();
    expect(calls).toHaveLength(0);
    expect((await client.getRefundEvidence("cha_prod", input.orderId)).environment).toBe("production");
    expect(new URLSearchParams(String(calls[0].init.body)).get("scope")).toBe("charges/read wallet/read");
    expect(calls.slice(1).every(c => !c.init.method || c.init.method === "GET")).toBe(true);
  });
  it("refuses production refunds even with writer mode", async () => {
    const { client, calls } = setup(() => json({}), { environment: "production", mode: "refund" });
    await expect(client.requestRefund("cha_prod", input.orderId, 100)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("trusted deployment selector", () => {
  const resolve = (env: Record<string, string>) => resolveValidaPayEnvironment(name => env[name]);
  it("defaults off and preserves only explicitly enabled legacy sandbox", () => {
    expect(resolve({})).toBe(null);
    expect(resolve({ VALIDAPAY_PRODUCTION_ENABLED: "true" })).toBe(null);
    expect(resolve({ VALIDAPAY_SANDBOX_ENABLED: "true" })).toBe("sandbox");
  });
  it("never falls back from invalid or production selector into enabled sandbox", () => {
    expect(resolve({ VALIDAPAY_ENVIRONMENT: "typo", VALIDAPAY_SANDBOX_ENABLED: "true" })).toBe(null);
    expect(resolve({ VALIDAPAY_ENVIRONMENT: "production", VALIDAPAY_SANDBOX_ENABLED: "true" })).toBe("production");
  });
});
