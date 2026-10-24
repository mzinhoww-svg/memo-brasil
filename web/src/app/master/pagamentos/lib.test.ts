import { describe, expect, it } from "vitest";
import { envInfo, funnelFromStatus, isStalePending, matchOrders, revenueByPlan, type OrderLite } from "./lib";

const o = (p: Partial<OrderLite>): OrderLite => ({ orderId: "o1", createdAt: "2026-10-23T10:00:00Z", status: "pago", planCode: "p100", planName: "Até 100", amountCents: 10000, ...p });

describe("envInfo", () => {
  it("explica cada ambiente", () => {
    expect(envInfo("production")).toMatchObject({ tone: "ok", title: "Produção" });
    expect(envInfo("sandbox")).toMatchObject({ tone: "warn", title: "Sandbox" });
    expect(envInfo("desligado")).toMatchObject({ tone: "info", title: "Desligado" });
    expect(envInfo("qualquer")).toMatchObject({ title: "Desligado" });
  });
});

describe("funnelFromStatus", () => {
  it("soma criados, pagos, pendentes e expirados", () => {
    const f = funnelFromStatus({
      pago: { count: 6, amountCents: 1 }, estornado: { count: 1, amountCents: 1 }, pendente: { count: 2, amountCents: 1 },
      criado: { count: 1, amountCents: 1 }, expirado: { count: 4, amountCents: 1 }, falhou: { count: 1, amountCents: 1 },
    });
    expect(f).toEqual({ created: 15, paid: 7, pending: 3, expired: 4, other: 1, paidRate: 7 / 15 });
  });
  it("vazio não divide por zero", () => {
    expect(funnelFromStatus({}).paidRate).toBeNull();
    expect(funnelFromStatus(null).created).toBe(0);
  });
});

describe("revenueByPlan", () => {
  it("agrupa só pagos e ordena por receita", () => {
    const r = revenueByPlan([
      o({ orderId: "a" }), o({ orderId: "b" }), o({ orderId: "c", planCode: "p250", planName: "Até 250", amountCents: 18900 }),
      o({ orderId: "d", status: "estornado" }), o({ orderId: "e", status: "pendente" }),
    ]);
    expect(r).toEqual([
      { code: "p100", name: "Até 100", sales: 2, revenueCents: 20000 },
      { code: "p250", name: "Até 250", sales: 1, revenueCents: 18900 },
    ]);
  });
  it("usa o código quando falta o nome", () => {
    expect(revenueByPlan([o({ planName: null })])[0].name).toBe("p100");
  });
});

describe("isStalePending", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  it("só pendente com mais de 1 h", () => {
    expect(isStalePending({ status: "pendente", createdAt: "2026-10-23T10:59:00Z" }, now)).toBe(true);
    expect(isStalePending({ status: "pendente", createdAt: "2026-10-23T11:30:00Z" }, now)).toBe(false);
    expect(isStalePending({ status: "pago", createdAt: "2026-10-23T01:00:00Z" }, now)).toBe(false);
    expect(isStalePending({ status: "pendente", createdAt: "x" }, now)).toBe(false);
  });
});

describe("matchOrders", () => {
  const list = [o({ orderId: "AAA-111", eventTitle: "Casamento Ana" }), o({ orderId: "BBB-222", providerPaymentId: "998877" })];
  it("sem q devolve tudo", () => { expect(matchOrders(list, "  ")).toHaveLength(2); expect(matchOrders(list, undefined)).toHaveLength(2); });
  it("casa por id do pedido, pagamento e evento sem diferenciar caixa", () => {
    expect(matchOrders(list, "aaa-1").map((x) => x.orderId)).toEqual(["AAA-111"]);
    expect(matchOrders(list, "9988").map((x) => x.orderId)).toEqual(["BBB-222"]);
    expect(matchOrders(list, "casamento").map((x) => x.orderId)).toEqual(["AAA-111"]);
    expect(matchOrders(list, "zzz")).toEqual([]);
  });
});
