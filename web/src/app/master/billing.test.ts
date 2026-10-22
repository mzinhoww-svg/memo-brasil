import { describe, expect, it } from "vitest";
import { MODULES } from "./modules";
import {
  brl, canRefund, refundFailureText, chargeHint, lastChange, divergenceText, envLabel, orderStatus, parseBrl, planPreview, reasonError, REASON_MAX, REASON_MIN,
} from "./billing";

describe("dinheiro", () => {
  it("formata centavos em reais pt-BR", () => {
    expect(brl(18900)).toBe("R$ 189,00");
    expect(brl(0)).toBe("R$ 0");
    expect(brl(193200, { compact: true })).toBe("R$ 1.932");
  });
  it("lê o preço digitado em reais", () => {
    expect(parseBrl("199,00")).toBe(19900);
    expect(parseBrl("R$ 1.234,5")).toBe(123450);
    expect(parseBrl("29")).toBe(2900);
    expect(parseBrl("29.90")).toBe(2990);
    expect(parseBrl("")).toBeNull();
    expect(parseBrl("abc")).toBeNull();
    expect(parseBrl("1,234")).toBeNull();
    expect(parseBrl("-5")).toBeNull();
  });
});

describe("motivo obrigatório", () => {
  it("exige de 10 a 500 caracteres depois de aparar", () => {
    expect(REASON_MIN).toBe(10);
    expect(REASON_MAX).toBe(500);
    expect(reasonError("   curto   ")).toMatch(/10/);
    expect(reasonError("x".repeat(501))).toMatch(/500/);
    expect(reasonError("Ajuste de preço após piloto")).toBeNull();
  });
});

describe("rótulos", () => {
  it("selo do ambiente", () => {
    expect(envLabel("desligado")).toBe("DESLIGADO");
    expect(envLabel("sandbox")).toBe("SANDBOX");
    expect(envLabel("production")).toBe("PRODUÇÃO");
  });
  it("status do pedido considera reembolso solicitado", () => {
    expect(orderStatus({ status: "pago", refundRequestedAt: null })).toEqual({ label: "pago", tone: "ok" });
    expect(orderStatus({ status: "pago", refundRequestedAt: "2026-10-22T10:00:00Z" })).toEqual({ label: "reembolso em andamento", tone: "aviso" });
    expect(orderStatus({ status: "cancelado", refundRequestedAt: "2026-10-22T10:00:00Z" })).toEqual({ label: "reembolso em andamento", tone: "aviso" });
    expect(orderStatus({ status: "em_disputa", refundRequestedAt: null })).toEqual({ label: "em disputa", tone: "erro" });
    expect(orderStatus({ status: "estornado", refundRequestedAt: "x" }).label).toBe("estornado");
    expect(orderStatus({ status: "em_disputa", refundRequestedAt: "x" })).toEqual({ label: "em disputa", tone: "erro" });
    expect(orderStatus({ status: "perdido", refundRequestedAt: "x" }).label).toBe("perdido");
  });
  it("cobrança abreviada", () => {
    expect(chargeHint("pix_char_abcdef0123456789c1")).toBe("pix_char_…9c1");
    expect(chargeHint(null)).toBe("—");
  });
  it("texto de divergência diz o que aconteceu", () => {
    expect(divergenceText("needs_refund")).toBe("Dinheiro recebido sem plano liberado. Precisa de reembolso.");
    expect(divergenceText("pago_sem_direito")).toMatch(/pago/i);
    expect(divergenceText("desconhecido")).toBe("desconhecido");
  });
  it("prévia do cartão do organizador", () => {
    expect(planPreview({ name: "Casamento", maxGuests: 250, maxShots: 36 }, 18900)).toEqual({ titulo: "Até 250 · R$ 189", nota: "Casamento · 36 fotos por pessoa" });
    expect(planPreview({ name: "Grande", maxGuests: 500, maxShots: null }, 34990)).toEqual({ titulo: "Até 500 · R$ 349,90", nota: "Grande · fotos sem limite" });
  });
});

describe("reembolso disponível", () => {
  it("pago ou cancelado com needs_refund, com cobrança (Ruling 16)", () => {
    expect(canRefund({ status: "pago", needsRefund: false, providerChargeId: "c" })).toBe(true);
    expect(canRefund({ status: "cancelado", needsRefund: true, providerChargeId: "c" })).toBe(true);
    expect(canRefund({ status: "cancelado", needsRefund: false, providerChargeId: "c" })).toBe(false);
    expect(canRefund({ status: "em_disputa", needsRefund: true, providerChargeId: "c" })).toBe(false);
    expect(canRefund({ status: "estornado", needsRefund: false, providerChargeId: "c" })).toBe(false);
    expect(canRefund({ status: "pago", needsRefund: false, providerChargeId: null })).toBe(false);
  });
});

describe("última alteração de preço", () => {
  it("data da alteração mais recente do histórico, ou nada", () => {
    expect(lastChange([{ history: [] }, { history: [] }])).toBeNull();
    expect(lastChange([{ history: [{ at: "2026-10-20T12:00:00Z" }] }, { history: [{ at: "2026-11-02T15:00:00Z" }, { at: "2026-10-01T12:00:00Z" }] }])).toBe("2026-11-02T15:00:00Z");
  });
});

describe("falha do reembolso", () => {
  it("cobrança que já não está paga no provedor tem texto próprio", () => {
    const t = "A AbacatePay já não mostra a cobrança como paga; a conciliação atualiza em até 5 minutos.";
    expect(refundFailureText("cobranca_nao_paga")).toBe(t);
    expect(refundFailureText("cobranca_nao_confere")).toBe(t);
    expect(refundFailureText("provedor_indisponivel")).toMatch(/Solicitação registrada/);
    expect(refundFailureText(undefined)).toMatch(/Solicitação registrada/);
  });
});

describe("módulos do console", () => {
  it("inclui Pagamentos e Planos e preços", () => {
    expect(MODULES).toHaveLength(15);
    expect(MODULES).toEqual(expect.arrayContaining([{ rota: "pagamentos", rotulo: "Pagamentos" }, { rota: "planos", rotulo: "Planos e preços" }]));
  });
});
