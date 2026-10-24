import { beforeEach, describe, expect, it } from "vitest";
import type { OrderView, PublicPlan } from "./types";
import { PLAN_TEXT, clearIdempotencyKey, countdown, idempotencyKeyFor, joinGuests, paymentLabel, parseReturn, planRank, reconcileCheckout, screenFor, trustTitle } from "./flow";

const NOW = Date.parse("2026-10-22T12:00:00Z");
const order = (o: Partial<OrderView> = {}): OrderView => ({ orderId: "o1", status: "pendente", planCode: "casamento", amountCents: 18900, provider: "mercadopago", expiresAt: new Date(NOW + 60_000).toISOString(), ...o });
const plan = (o: Partial<PublicPlan> = {}): PublicPlan => ({ code: "casamento", name: "Casamento", maxGuests: 250, maxShots: 36, priceCents: 18900, isFree: false, features: [], ...o });

describe("screenFor (estado do pedido -> tela)", () => {
  it("sem pedido: escolha", () => expect(screenFor(null, NOW)).toBe("escolha"));
  it("pendente e criado dentro do prazo: pendente", () => {
    expect(screenFor(order(), NOW)).toBe("pendente");
    expect(screenFor(order({ status: "criado" }), NOW)).toBe("pendente");
  });
  it("pendente vencido localmente vira expirado", () => expect(screenFor(order({ expiresAt: new Date(NOW - 1).toISOString() }), NOW)).toBe("expirado"));
  it("pendente sem expiresAt continua pendente", () => expect(screenFor(order({ expiresAt: undefined }), NOW)).toBe("pendente"));
  it("estados terminais", () => {
    expect(screenFor(order({ status: "pago" }), NOW)).toBe("pago");
    expect(screenFor(order({ status: "expirado" }), NOW)).toBe("expirado");
    expect(screenFor(order({ status: "falhou" }), NOW)).toBe("falhou");
    expect(screenFor(order({ status: "cancelado" }), NOW)).toBe("falhou");
    expect(screenFor(order({ status: "perdido" }), NOW)).toBe("falhou");
    expect(screenFor(order({ status: "estornado" }), NOW)).toBe("estornado");
    expect(screenFor(order({ status: "em_disputa" }), NOW)).toBe("em_disputa");
  });
});

describe("countdown", () => {
  it("mm:ss", () => expect(countdown(new Date(NOW + 29_000 + 29 * 60_000).toISOString(), NOW)).toBe("29:29"));
  it("arredonda para cima e zera sem negativo", () => {
    expect(countdown(new Date(NOW + 500).toISOString(), NOW)).toBe("0:01");
    expect(countdown(new Date(NOW - 5000).toISOString(), NOW)).toBe("0:00");
  });
  it("sem data: null", () => expect(countdown(undefined, NOW)).toBeNull());
});

describe("idempotência por evento + plano", () => {
  beforeEach(() => sessionStorage.clear());
  it("reusa a chave (clique duplo = mesma chave)", () => {
    const a = idempotencyKeyFor("e1", "casamento");
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(idempotencyKeyFor("e1", "casamento")).toBe(a);
  });
  it("evento ou plano diferente gera chave diferente", () => {
    const a = idempotencyKeyFor("e1", "casamento");
    expect(idempotencyKeyFor("e1", "festa")).not.toBe(a);
    expect(idempotencyKeyFor("e2", "casamento")).not.toBe(a);
  });
  it("clear gera nova intenção", () => {
    const a = idempotencyKeyFor("e1", "casamento");
    clearIdempotencyKey("e1", "casamento");
    expect(idempotencyKeyFor("e1", "casamento")).not.toBe(a);
  });
  it("funciona sem sessionStorage", () => {
    const orig = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
    Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new Error("bloqueado"); } });
    try { expect(idempotencyKeyFor("e1", "casamento")).toMatch(/^[0-9a-f-]{36}$/); } finally { Object.defineProperty(window, "sessionStorage", orig); }
  });
});

describe("reconcileCheckout (409 pedido_aberto de outro plano)", () => {
  it("mesmo plano: sem aviso", () => expect(reconcileCheckout(order(), "casamento")).toEqual({ order: order(), otherPlan: false }));
  it("outro plano: mostra o pedido existente com aviso", () => expect(reconcileCheckout(order({ planCode: "festa" }), "casamento").otherPlan).toBe(true));
});

describe("TrustBlock e textos", () => {
  it("Casamento: 250 olhares por R$ 0,76", () => expect(trustTitle(plan())).toBe("250 olhares por R$ 0,76 cada."));
  it("Grande usa 500", () => expect(trustTitle(plan({ code: "grande", maxGuests: null, priceCents: 34900 }))).toBe("500 olhares por R$ 0,70 cada."));
  it("Grátis omite o título", () => expect(trustTitle(plan({ code: "gratis", isFree: true, maxGuests: 10, priceCents: 0 }))).toBeNull());
  it("mensagem do MM013 e textos exatos", () => {
    expect(PLAN_TEXT.expirado).toBe("Nada foi cobrado. Quando quiser, comece um novo pagamento.");
    expect(PLAN_TEXT.sub).toBe("Pix ou cartão, pagamento único por evento, no Mercado Pago. Sem assinatura.");
    expect(PLAN_TEXT.provedor).toBe("Seu pedido está guardado; tente de novo em 1 minuto.");
  });
  it("joinGuests e rank", () => {
    expect(joinGuests(250, 36)).toBe("Até 250 convidados e 36 fotos cada.");
    expect(joinGuests(500, null)).toBe("Até 500 convidados e fotos sem limite.");
    expect(planRank([plan({ code: "a" }), plan({ code: "b" })], "b")).toBe(1);
    expect(planRank([plan({ code: "a" })], "zzz")).toBe(0);
  });
  it("rótulo da forma de pagamento: conhecidos, histórico AbacatePay e desconhecidos", () => {
    expect(paymentLabel(order({ paymentMethod: "pix" }))).toBe("Pix");
    expect(paymentLabel(order({ paymentMethod: "card" }))).toBe("Cartão");
    expect(paymentLabel(order({ paymentMethod: "credit_card" }))).toBe("Cartão");
    expect(paymentLabel(order({ paymentMethod: "debit_card" }))).toBe("Cartão");
    expect(paymentLabel(order())).toBe("Mercado Pago");
    expect(paymentLabel(order({ paymentMethod: "ticket_novo" }))).toBe("Mercado Pago");
    expect(paymentLabel(order({ provider: "abacatepay" }))).toBe("Pix (AbacatePay)");
  });
});

describe("parseReturn (retorno do Checkout Pro é só dica)", () => {
  it("lê retorno e remove os parâmetros do provedor, preservando os demais", () => {
    expect(parseReturn("?plano=casamento&retorno=sucesso&payment_id=1&status=approved&collection_id=1&collection_status=approved&external_reference=x&preference_id=p&payment_type=card&merchant_order_id=2&site_id=MLB&processing_mode=aggregator&merchant_account_id=null"))
      .toEqual({ hint: "sucesso", search: "?plano=casamento" });
    expect(parseReturn("?retorno=pendente&status=pending")).toEqual({ hint: "pendente", search: "" });
    expect(parseReturn("?retorno=falha")).toEqual({ hint: "falha", search: "" });
  });
  it("valor desconhecido de retorno não vira dica, mas os parâmetros são limpos", () => {
    expect(parseReturn("?retorno=hack&status=approved")).toEqual({ hint: null, search: "" });
  });
  it("sem parâmetros do retorno: nada a limpar", () => {
    expect(parseReturn("")).toEqual({ hint: null, search: "" });
    expect(parseReturn("?plano=festa")).toEqual({ hint: null, search: "?plano=festa" });
  });
});
