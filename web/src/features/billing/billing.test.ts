import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mode: "supabase" as "local" | "supabase", client: undefined as unknown }));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => mocks.mode }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => mocks.client }));

import {
  BillingError, BillingUnavailableError, OpenOrderError, ProviderUnavailableError, formatBRL, getPublicSettings, listPublicPlans,
  normalizeCode, openOrder, orderStatus, quote, redeemCode, startCheckout,
} from "./api";

const EVENT = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";

it("preserves ValidaPay identity when recovering an order through the shared billing API", async () => {
  fakeClient({ invoke: () => ({ data: { orderId: ORDER, status: "pendente", amountCents: 2900, planCode: "festa", provider: "validapay" } }) });
  expect((await orderStatus(ORDER)).provider).toBe("validapay");
});

/** Erro de função com status e corpo, no formato do supabase-js (FunctionsHttpError.context = Response). */
const httpError = (status: number, body: unknown) => ({ name: "FunctionsHttpError", message: "non-2xx", context: new Response(JSON.stringify(body), { status }) });

function fakeClient(opts: {
  rpc?: (fn: string, args: unknown) => { data?: unknown; error?: { code?: string; message?: string } | null };
  invoke?: (fn: string, init: { body: unknown }) => { data?: unknown; error?: unknown };
  rows?: Record<string, unknown>[];
}) {
  const calls = { rpc: [] as [string, unknown][], invoke: [] as [string, unknown][], from: [] as { table: string; filters: unknown[] }[] };
  const client = {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      calls.rpc.push([fn, args]);
      const r = opts.rpc?.(fn, args) ?? { data: null, error: { code: "XX", message: "sem mock" } };
      return { data: r.data ?? null, error: r.error ?? null };
    }),
    functions: {
      invoke: vi.fn(async (fn: string, init: { body: unknown }) => {
        calls.invoke.push([fn, init.body]);
        const r = opts.invoke?.(fn, init) ?? { error: httpError(500, { error: "sem mock" }) };
        return { data: r.data ?? null, error: r.error ?? null };
      }),
    },
    from: vi.fn((table: string) => {
      const entry = { table, filters: [] as unknown[] };
      calls.from.push(entry);
      const q = {
        select: (...a: unknown[]) => (entry.filters.push(["select", ...a]), q),
        eq: (...a: unknown[]) => (entry.filters.push(["eq", ...a]), q),
        order: (...a: unknown[]) => (entry.filters.push(["order", ...a]), q),
        limit: (...a: unknown[]) => (entry.filters.push(["limit", ...a]), q),
        then: (res: (v: unknown) => unknown) => Promise.resolve({ data: opts.rows ?? [], error: null }).then(res),
      };
      return q;
    }),
  };
  mocks.client = client;
  return calls;
}

beforeEach(() => {
  mocks.mode = "supabase";
  mocks.client = undefined;
});

describe("formatBRL", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(18900)).toBe("R$ 189,00");
    expect(formatBRL(100)).toBe("R$ 1,00");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });
});

describe("normalizeCode", () => {
  it("maiúsculas, sem espaços e com a hifenização MMT-XXXX-XXXX", () => {
    expect(normalizeCode(" mmt 7kq4-xr2p ")).toBe("MMT-7KQ4-XR2P");
    expect(normalizeCode("mmt7kq4xr2p")).toBe("MMT-7KQ4-XR2P");
    expect(normalizeCode("MMT-7KQ4-XR2P")).toBe("MMT-7KQ4-XR2P");
    expect(normalizeCode("7kq4 xr2p")).toBe("MMT-7KQ4-XR2P");
    expect(normalizeCode(" abc ")).toBe("ABC");
  });
});

describe("modo local", () => {
  it("lista só Grátis e as demais lançam BillingUnavailableError", async () => {
    mocks.mode = "local";
    const plans = await listPublicPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ code: "gratis", isFree: true, priceCents: 0, maxGuests: 10, maxShots: 10 });
    await expect(quote(EVENT, "festa")).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(startCheckout(EVENT, "festa", KEY)).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(orderStatus(ORDER)).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(openOrder(EVENT)).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(redeemCode(EVENT, "MMT-7KQ4-XR2P")).rejects.toBeInstanceOf(BillingUnavailableError);
    expect((await getPublicSettings()).paymentsEnv).toBe("desligado");
  });
});

describe("planos e configurações públicas", () => {
  it("listPublicPlans mapeia o jsonb do servidor", async () => {
    fakeClient({ rpc: () => ({ data: [
      { code: "gratis", name: "Grátis", maxGuests: 10, maxShots: 10, priceCents: 0, sort: 0, isFree: true, features: [] },
      { code: "grande", name: "Grande", maxGuests: 500, maxShots: null, priceCents: 34900, sort: 4, isFree: false, features: ["a"] },
    ] }) });
    expect(await listPublicPlans()).toEqual([
      { code: "gratis", name: "Grátis", maxGuests: 10, maxShots: 10, priceCents: 0, isFree: true, features: [], highlighted: false },
      { code: "grande", name: "Grande", maxGuests: 500, maxShots: null, priceCents: 34900, isFree: false, features: ["a"], highlighted: false },
    ]);
  });
  it("getPublicSettings converte snake_case", async () => {
    fakeClient({ rpc: () => ({ data: { support_email: "a@b.c", support_phone: null, company_legal_name: "X Ltda", company_cnpj: null, payments_env: "sandbox", capacity_grace_pct: 10 } }) });
    expect(await getPublicSettings()).toEqual({ supportEmail: "a@b.c", supportPhone: null, companyLegalName: "X Ltda", companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 });
  });
});

describe("quote", () => {
  it("chama payments_quote e devolve valor_minimo como motivo", async () => {
    const calls = fakeClient({ rpc: () => ({ data: { planCode: "festa", fromPlanCode: "gratis", amountCents: 50, payable: false, reason: "valor_minimo" } }) });
    expect(await quote(EVENT, "festa")).toEqual({ planCode: "festa", fromPlanCode: "gratis", amountCents: 50, payable: false, reason: "valor_minimo" });
    expect(calls.rpc).toEqual([["payments_quote", { p_event: EVENT, p_plan: "festa" }]]);
  });
  it("motivo desconhecido vira plano_inativo e nunca é cobrável", async () => {
    fakeClient({ rpc: () => ({ data: { planCode: "festa", fromPlanCode: null, amountCents: 2900, payable: true, reason: "novo_motivo" } }) });
    expect(await quote(EVENT, "festa")).toMatchObject({ payable: false, reason: "plano_inativo" });
  });
  it("MM014 (pagamentos desligados) vira BillingUnavailableError", async () => {
    fakeClient({ rpc: () => ({ error: { code: "MM014", message: "pagamentoindisponivel" } }) });
    await expect(quote(EVENT, "festa")).rejects.toBeInstanceOf(BillingUnavailableError);
  });
});

describe("startCheckout", () => {
  const URL_MP = "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123-abc";
  const view = { orderId: ORDER, status: "pendente", planCode: "festa", amountCents: 2900, checkoutUrl: URL_MP, expiresAt: "2026-10-22T12:30:00Z", paidAt: null, provider: "mercadopago", paymentMethod: null };

  it("envia idempotencyKey e mapeia 409 pedido_aberto para OrderView existente", async () => {
    const calls = fakeClient({
      invoke: (fn) => (fn === "payments-checkout" ? { error: httpError(409, { error: "pedido_aberto", orderId: ORDER }) } : { data: view }),
    });
    const r = await startCheckout(EVENT, "casamento", KEY);
    expect(calls.invoke[0]).toEqual(["payments-checkout", { eventId: EVENT, planCode: "casamento", idempotencyKey: KEY }]);
    expect(calls.invoke[1]).toEqual(["payments-status", { orderId: ORDER }]);
    expect(r).toEqual({ orderId: ORDER, status: "pendente", planCode: "festa", amountCents: 2900, checkoutUrl: URL_MP, expiresAt: "2026-10-22T12:30:00Z", provider: "mercadopago" });
    expect(r.planCode).not.toBe("casamento"); // 409 de OUTRO plano: o chamador compara planCode com o pedido
  });
  it("200 sem planCode no corpo usa o plano pedido; nulos viram ausentes", async () => {
    fakeClient({ invoke: () => ({ data: { orderId: ORDER, status: "pendente", amountCents: 2900, checkoutUrl: URL_MP, expiresAt: null, provider: "mercadopago" } }) });
    expect(await startCheckout(EVENT, "festa", KEY)).toEqual({ orderId: ORDER, status: "pendente", planCode: "festa", amountCents: 2900, checkoutUrl: URL_MP, provider: "mercadopago" });
  });
  it("startCheckout devolve checkoutUrl e nunca brCode/brCodeBase64, mesmo que o servidor mande", async () => {
    fakeClient({ invoke: () => ({ data: { ...view, brCode: "00020126", brCodeBase64: "b64" } }) });
    const r = await startCheckout(EVENT, "festa", KEY);
    expect(r.checkoutUrl).toBe(URL_MP);
    expect(r).not.toHaveProperty("brCode");
    expect(r).not.toHaveProperty("brCodeBase64");
  });
  it("checkoutUrl inseguro (javascript:, http fora de loopback, lixo) é descartado; loopback http vale para a fake local", async () => {
    for (const bad of ["javascript:alert(1)", "http://evil.example/pay", "//evil.example", "nao-e-url", 42]) {
      fakeClient({ invoke: () => ({ data: { ...view, checkoutUrl: bad } }) });
      expect((await startCheckout(EVENT, "festa", KEY)).checkoutUrl).toBeUndefined();
    }
    fakeClient({ invoke: () => ({ data: { ...view, checkoutUrl: "http://127.0.0.1:55491/checkout/abc" } }) });
    expect((await startCheckout(EVENT, "festa", KEY)).checkoutUrl).toBe("http://127.0.0.1:55491/checkout/abc");
  });
  it("provider e paymentMethod desconhecidos viram valores seguros", async () => {
    fakeClient({ invoke: () => ({ data: { ...view, provider: "outro", paymentMethod: "boleto" } }) });
    expect(await startCheckout(EVENT, "festa", KEY)).toMatchObject({ provider: "mercadopago", paymentMethod: "boleto" });
    fakeClient({ invoke: () => ({ data: { ...view, provider: "abacatepay", paymentMethod: "pix" } }) });
    expect(await startCheckout(EVENT, "festa", KEY)).toMatchObject({ provider: "abacatepay", paymentMethod: "pix" });
    fakeClient({ invoke: () => ({ data: { ...view, status: "algo_novo" } }) });
    expect((await startCheckout(EVENT, "festa", KEY)).status).toBe("falhou");
  });
  it("409 pedido_aberto de outro plano fora da lista cai em orderStatus e preserva o planCode do pedido existente", async () => {
    fakeClient({ invoke: (fn) => (fn === "payments-checkout" ? { error: httpError(409, { error: "pedido_aberto", orderId: ORDER }) } : { data: { ...view, planCode: "grande", amountCents: 34900 } }) });
    expect(await startCheckout(EVENT, "festa", KEY)).toMatchObject({ planCode: "grande", amountCents: 34900 });
  });
  it("409 sem pedido localizável lança OpenOrderError tipado", async () => {
    fakeClient({ rows: [], invoke: () => ({ error: httpError(409, { error: "pedido_aberto", orderId: null }) }) });
    const e = await startCheckout(EVENT, "festa", KEY).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(OpenOrderError);
    expect(e).toMatchObject({ code: "pedido_aberto", status: 409, orderId: null });
  });
  it("409 sem orderId devolve só pedido realmente aberto; senão relança pedido_aberto", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    const old = new Date(Date.now() - 31 * 60_000).toISOString();
    const r409 = () => ({ error: httpError(409, { error: "pedido_aberto", orderId: null }) });
    const base = { plan_code: "festa", amount_cents: 2900, provider: "mercadopago", checkout_url: null, payment_method: null, expires_at: null, paid_at: null };
    fakeClient({ rows: [{ ...base, id: "o-pago", status: "pago", created_at: recent }], invoke: r409 });
    await expect(startCheckout(EVENT, "festa", KEY)).rejects.toMatchObject({ code: "pedido_aberto", status: 409 });
    fakeClient({ rows: [{ ...base, id: "o-velho", status: "criado", created_at: old }], invoke: r409 });
    await expect(startCheckout(EVENT, "festa", KEY)).rejects.toMatchObject({ code: "pedido_aberto" });
    const calls = fakeClient({
      rows: [{ ...base, id: ORDER, status: "criado", created_at: recent }],
      invoke: (fn) => (fn === "payments-checkout" ? r409() : { data: { ...view, status: "criado" } }),
    });
    expect(await startCheckout(EVENT, "festa", KEY)).toMatchObject({ orderId: ORDER, status: "criado" });
    expect(calls.invoke[1]).toEqual(["payments-status", { orderId: ORDER }]);
  });
  it("502 lança ProviderUnavailableError com orderId", async () => {
    fakeClient({ invoke: () => ({ error: httpError(502, { error: "provedor_indisponivel", orderId: ORDER }) }) });
    const e = await startCheckout(EVENT, "festa", KEY).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ProviderUnavailableError);
    expect((e as ProviderUnavailableError).orderId).toBe(ORDER);
  });
  it("502 sem corpo legível ainda é ProviderUnavailableError (orderId nulo)", async () => {
    fakeClient({ invoke: () => ({ error: { name: "FunctionsHttpError", message: "x", context: new Response("<html>bad gateway</html>", { status: 502 }) } }) });
    const e = await startCheckout(EVENT, "festa", KEY).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ProviderUnavailableError);
    expect((e as ProviderUnavailableError).orderId).toBeNull();
  });
  it("503 lança BillingUnavailableError; 422 lança BillingError com o código", async () => {
    fakeClient({ invoke: () => ({ error: httpError(503, { error: "pagamento_indisponivel" }) }) });
    await expect(startCheckout(EVENT, "festa", KEY)).rejects.toBeInstanceOf(BillingUnavailableError);
    fakeClient({ invoke: () => ({ error: httpError(422, { error: "valor_minimo" }) }) });
    const e = await startCheckout(EVENT, "festa", KEY).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(BillingError);
    expect(e).toMatchObject({ code: "valor_minimo", status: 422 });
  });
});

describe("orderStatus", () => {
  it("chama payments-status e 404 vira BillingError nao_encontrado", async () => {
    const calls = fakeClient({ invoke: () => ({ data: { orderId: ORDER, status: "pago", planCode: "festa", amountCents: 2900, checkoutUrl: null, expiresAt: null, paidAt: "2026-10-22T12:01:00Z", provider: "mercadopago", paymentMethod: "pix" } }) });
    expect(await orderStatus(ORDER)).toEqual({ orderId: ORDER, status: "pago", planCode: "festa", amountCents: 2900, paidAt: "2026-10-22T12:01:00Z", provider: "mercadopago", paymentMethod: "pix" });
    expect(calls.invoke[0]).toEqual(["payments-status", { orderId: ORDER }]);
    fakeClient({ invoke: () => ({ error: httpError(404, { error: "nao_encontrado" }) }) });
    await expect(orderStatus(ORDER)).rejects.toMatchObject({ code: "nao_encontrado", status: 404 });
  });
});

it.each([true, false, undefined])("preserves only explicit disposition booleans: %s", async (entitlementActive) => {
  fakeClient({ invoke: () => ({ data: { orderId: ORDER, status: "pago", planCode: "festa", amountCents: 2900, provider: "mercadopago", entitlementActive, needsRefund: false } }) });
  const result = await orderStatus(ORDER);
  expect(result.entitlementActive).toBe(entitlementActive);
  expect(result.needsRefund).toBe(false);
});
it("does not coerce an untrusted disposition into activation", async () => {
  fakeClient({ invoke: () => ({ data: { orderId: ORDER, status: "pago", planCode: "festa", amountCents: 2900, entitlementActive: "true", needsRefund: "false" } }) });
  const result = await orderStatus(ORDER);
  expect(result.entitlementActive).toBeUndefined(); expect(result.needsRefund).toBeUndefined();
});

describe("openOrder", () => {
  const row = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
    id, status, plan_code: "festa", amount_cents: 2900, provider: "mercadopago", checkout_url: null, payment_method: null, expires_at: null, paid_at: null, created_at: "2026-10-22T12:00:00Z", ...extra,
  });
  it("sem pedidos devolve null", async () => {
    fakeClient({ rows: [] });
    expect(await openOrder(EVENT)).toBeNull();
  });
  it("prefere o pedido aberto e atualiza pelo payments-status", async () => {
    const future = new Date(Date.now() + 600_000).toISOString();
    const calls = fakeClient({
      rows: [row("o-ultimo", "falhou"), row(ORDER, "pendente", { expires_at: future })],
      invoke: () => ({ data: { orderId: ORDER, status: "pago", planCode: "festa", amountCents: 2900, paidAt: "2026-10-22T12:01:00Z" } }),
    });
    expect(await openOrder(EVENT)).toMatchObject({ orderId: ORDER, status: "pago" });
    expect(calls.from[0].table).toBe("payment_orders");
    expect(calls.from[0].filters).toContainEqual(["eq", "event_id", EVENT]);
    expect(calls.invoke[0]).toEqual(["payments-status", { orderId: ORDER }]);
  });
  it("sem aberto devolve o mais recente sem chamar a função se for terminal", async () => {
    const calls = fakeClient({ rows: [row("o-ultimo", "estornado", { paid_at: "2026-10-22T12:01:00Z" }), row("o-velho", "pago")] });
    expect(await openOrder(EVENT)).toEqual({ orderId: "o-ultimo", status: "estornado", planCode: "festa", amountCents: 2900, paidAt: "2026-10-22T12:01:00Z", provider: "mercadopago" });
    expect(calls.invoke).toHaveLength(0);
  });
  it("se o payments-status falhar (evento excluído: MM004 → 404), devolve os dados da linha", async () => {
    fakeClient({ rows: [row(ORDER, "pendente", { checkout_url: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=9" })], invoke: () => ({ error: httpError(404, { error: "nao_encontrado" }) }) });
    expect(await openOrder(EVENT)).toEqual({ orderId: ORDER, status: "pendente", planCode: "festa", amountCents: 2900, checkoutUrl: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=9", provider: "mercadopago" });
  });
  it("pedido histórico AbacatePay continua legível (provider preservado, sem checkoutUrl)", async () => {
    fakeClient({ rows: [row("o-aba", "pago", { provider: "abacatepay", paid_at: "2026-10-22T12:01:00Z" })], invoke: () => ({ data: { orderId: "o-aba", status: "pago", planCode: "festa", amountCents: 2900, paidAt: "2026-10-22T12:01:00Z", provider: "abacatepay" } }) });
    expect(await openOrder(EVENT)).toEqual({ orderId: "o-aba", status: "pago", planCode: "festa", amountCents: 2900, paidAt: "2026-10-22T12:01:00Z", provider: "abacatepay" });
  });
  it("lê só colunas do contrato novo (sem brcode)", async () => {
    const calls = fakeClient({ rows: [] });
    await openOrder(EVENT);
    const sel = calls.from[0].filters.find((f) => (f as unknown[])[0] === "select") as string[];
    expect(sel[1]).toContain("checkout_url");
    expect(sel[1]).toContain("provider");
    expect(sel[1]).not.toMatch(/brcode/);
  });
});

describe("openOrder: erros e enums", () => {
  const recent = () => new Date(Date.now() - 60_000).toISOString();
  const r = (status: string) => ({ id: ORDER, status, plan_code: "festa", amount_cents: 2900, provider: "mercadopago", checkout_url: null, payment_method: null, expires_at: null, paid_at: null, created_at: recent() });
  it("503 do payments-status propaga como BillingUnavailableError", async () => {
    fakeClient({ rows: [r("pendente")], invoke: () => ({ error: httpError(503, { error: "pagamento_indisponivel" }) }) });
    await expect(openOrder(EVENT)).rejects.toBeInstanceOf(BillingUnavailableError);
  });
  it("status desconhecido vira falhou e não é tratado como aberto", async () => {
    const calls = fakeClient({ rows: [r("status_novo")] });
    expect(await openOrder(EVENT)).toMatchObject({ orderId: ORDER, status: "falhou" });
    expect(calls.invoke).toHaveLength(0);
  });
});

describe("redeemCode", () => {
  it("normaliza o código e chama redeem_code", async () => {
    const calls = fakeClient({ rpc: () => ({ data: { applied: true, planCode: "festa", reason: "ok" } }) });
    expect(await redeemCode(EVENT, " mmt 7kq4-xr2p ")).toEqual({ applied: true, planCode: "festa", reason: "ok" });
    expect(calls.rpc).toEqual([["redeem_code", { p_event: EVENT, p_code: "MMT-7KQ4-XR2P" }]]);
  });
  it("muitas_tentativas, evento_encerrado e invalido voltam como motivo, sem lançar", async () => {
    fakeClient({ rpc: () => ({ data: { applied: false, planCode: null, reason: "muitas_tentativas" } }) });
    expect(await redeemCode(EVENT, "x")).toEqual({ applied: false, planCode: null, reason: "muitas_tentativas" });
    fakeClient({ rpc: () => ({ data: { applied: false, planCode: null, reason: "evento_encerrado" } }) });
    expect(await redeemCode(EVENT, "x")).toEqual({ applied: false, planCode: null, reason: "evento_encerrado" });
    fakeClient({ rpc: () => ({ data: { applied: false, planCode: null, reason: "outro" } }) });
    expect((await redeemCode(EVENT, "x")).reason).toBe("invalido");
  });
  it("erro do banco vira BillingError com o código", async () => {
    fakeClient({ rpc: () => ({ error: { code: "MM004", message: "forbidden" } }) });
    await expect(redeemCode(EVENT, "x")).rejects.toMatchObject({ code: "MM004" });
  });
});

describe("billing de demonstração removido", () => {
  const SRC = join(process.cwd(), "src"); // vitest roda a partir de web/
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  it("nenhum módulo importa domain/pricing e os símbolos de demonstração sumiram", () => {
    const offenders = files(SRC).filter((f) => !f.endsWith(join("features", "billing", "billing.test.ts")) && /domain\/pricing|\bpriceRule\b|\blocalBilling\b|\bDemoOnlyError\b|\bPLUS_GUEST_LIMIT\b|\bFREE_GUEST_LIMIT\b|\bBillingService\b|\bPurchaseRequest\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
