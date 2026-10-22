import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mode: "supabase" as "local" | "supabase", client: undefined as unknown }));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => mocks.mode }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => mocks.client }));

import {
  BillingError, BillingUnavailableError, ProviderUnavailableError, formatBRL, getPublicSettings, listPublicPlans,
  normalizeCode, openOrder, orderStatus, quote, redeemCode, startCheckout,
} from "./api";

const EVENT = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";

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
      { code: "gratis", name: "Grátis", maxGuests: 10, maxShots: 10, priceCents: 0, isFree: true, features: [] },
      { code: "grande", name: "Grande", maxGuests: 500, maxShots: null, priceCents: 34900, isFree: false, features: ["a"] },
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
  it("MM014 (pagamentos desligados) vira BillingUnavailableError", async () => {
    fakeClient({ rpc: () => ({ error: { code: "MM014", message: "pagamentoindisponivel" } }) });
    await expect(quote(EVENT, "festa")).rejects.toBeInstanceOf(BillingUnavailableError);
  });
});

describe("startCheckout", () => {
  const view = { orderId: ORDER, status: "pendente", planCode: "festa", amountCents: 2900, brCode: "pix", brCodeBase64: "b64", expiresAt: "2026-10-22T12:30:00Z", paidAt: null };

  it("envia idempotencyKey e mapeia 409 pedido_aberto para OrderView existente", async () => {
    const calls = fakeClient({
      invoke: (fn) => (fn === "payments-checkout" ? { error: httpError(409, { error: "pedido_aberto", orderId: ORDER }) } : { data: view }),
    });
    const r = await startCheckout(EVENT, "casamento", KEY);
    expect(calls.invoke[0]).toEqual(["payments-checkout", { eventId: EVENT, planCode: "casamento", idempotencyKey: KEY }]);
    expect(calls.invoke[1]).toEqual(["payments-status", { orderId: ORDER }]);
    expect(r).toEqual({ orderId: ORDER, status: "pendente", planCode: "festa", amountCents: 2900, brCode: "pix", brCodeBase64: "b64", expiresAt: "2026-10-22T12:30:00Z" });
  });
  it("200 sem planCode no corpo usa o plano pedido; nulos viram ausentes", async () => {
    fakeClient({ invoke: () => ({ data: { orderId: ORDER, status: "pendente", amountCents: 2900, brCode: "pix", brCodeBase64: null, expiresAt: null } }) });
    expect(await startCheckout(EVENT, "festa", KEY)).toEqual({ orderId: ORDER, status: "pendente", planCode: "festa", amountCents: 2900, brCode: "pix" });
  });
  it("502 lança ProviderUnavailableError com orderId", async () => {
    fakeClient({ invoke: () => ({ error: httpError(502, { error: "provedor_indisponivel", orderId: ORDER }) }) });
    const e = await startCheckout(EVENT, "festa", KEY).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ProviderUnavailableError);
    expect((e as ProviderUnavailableError).orderId).toBe(ORDER);
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
    const calls = fakeClient({ invoke: () => ({ data: { orderId: ORDER, status: "pago", planCode: "festa", amountCents: 2900, brCode: null, brCodeBase64: null, expiresAt: null, paidAt: "2026-10-22T12:01:00Z" } }) });
    expect(await orderStatus(ORDER)).toEqual({ orderId: ORDER, status: "pago", planCode: "festa", amountCents: 2900, paidAt: "2026-10-22T12:01:00Z" });
    expect(calls.invoke[0]).toEqual(["payments-status", { orderId: ORDER }]);
    fakeClient({ invoke: () => ({ error: httpError(404, { error: "nao_encontrado" }) }) });
    await expect(orderStatus(ORDER)).rejects.toMatchObject({ code: "nao_encontrado", status: 404 });
  });
});

describe("openOrder", () => {
  const row = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
    id, status, plan_code: "festa", amount_cents: 2900, brcode: null, brcode_base64: null, expires_at: null, paid_at: null, created_at: "2026-10-22T12:00:00Z", ...extra,
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
    expect(await openOrder(EVENT)).toEqual({ orderId: "o-ultimo", status: "estornado", planCode: "festa", amountCents: 2900, paidAt: "2026-10-22T12:01:00Z" });
    expect(calls.invoke).toHaveLength(0);
  });
  it("se o payments-status falhar (evento excluído: MM004 → 404), devolve os dados da linha", async () => {
    fakeClient({ rows: [row(ORDER, "pendente", { brcode: "pix" })], invoke: () => ({ error: httpError(404, { error: "nao_encontrado" }) }) });
    expect(await openOrder(EVENT)).toEqual({ orderId: ORDER, status: "pendente", planCode: "festa", amountCents: 2900, brCode: "pix" });
  });
});

describe("redeemCode", () => {
  it("normaliza o código e chama redeem_code", async () => {
    const calls = fakeClient({ rpc: () => ({ data: { applied: true, planCode: "festa", reason: "ok" } }) });
    expect(await redeemCode(EVENT, " mmt 7kq4-xr2p ")).toEqual({ applied: true, planCode: "festa", reason: "ok" });
    expect(calls.rpc).toEqual([["redeem_code", { p_event: EVENT, p_code: "MMT-7KQ4-XR2P" }]]);
  });
  it("muitas_tentativas e invalido voltam como motivo, sem lançar", async () => {
    fakeClient({ rpc: () => ({ data: { applied: false, planCode: null, reason: "muitas_tentativas" } }) });
    expect(await redeemCode(EVENT, "x")).toEqual({ applied: false, planCode: null, reason: "muitas_tentativas" });
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
    const offenders = files(SRC).filter((f) => !f.endsWith(join("features", "billing", "billing.test.ts")) && /domain\/pricing|\bpriceRule\b|\blocalBilling\b|\bDemoOnlyError\b|\bPLUS_GUEST_LIMIT\b|\bBillingService\b|\bPurchaseRequest\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
