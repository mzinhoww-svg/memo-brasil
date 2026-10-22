import { describe, expect, it } from "vitest";
import { MODULES } from "./modules";
import {
  brl, chargeHint, divergenceText, envLabel, orderStatus, parseBrl, planPreview, reasonError, REASON_MAX, REASON_MIN,
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
    expect(orderStatus({ status: "pago", refundRequestedAt: "2026-10-22T10:00:00Z" })).toEqual({ label: "reembolso pendente", tone: "aviso" });
    expect(orderStatus({ status: "em_disputa", refundRequestedAt: null })).toEqual({ label: "em disputa", tone: "erro" });
    expect(orderStatus({ status: "estornado", refundRequestedAt: "x" }).label).toBe("estornado");
  });
  it("cobrança abreviada", () => {
    expect(chargeHint("pix_char_abcdef0123456789c1")).toBe("pix_char_…9c1");
    expect(chargeHint(null)).toBe("—");
  });
  it("texto de divergência diz o que aconteceu", () => {
    expect(divergenceText("needs_refund")).toMatch(/reembolso/i);
    expect(divergenceText("pago_sem_direito")).toMatch(/pago/i);
    expect(divergenceText("desconhecido")).toBe("desconhecido");
  });
  it("prévia do cartão do organizador", () => {
    expect(planPreview({ name: "Casamento", maxGuests: 250, maxShots: 36 }, 18900)).toEqual({ titulo: "Até 250 · R$ 189", nota: "Casamento · 36 fotos por pessoa" });
    expect(planPreview({ name: "Grande", maxGuests: 500, maxShots: null }, 34990)).toEqual({ titulo: "Até 500 · R$ 349,90", nota: "Grande · fotos sem limite" });
  });
});

describe("módulos do console", () => {
  it("inclui Pagamentos e Planos e preços", () => {
    expect(MODULES).toHaveLength(14);
    expect(MODULES).toEqual(expect.arrayContaining([{ rota: "pagamentos", rotulo: "Pagamentos" }, { rota: "planos", rotulo: "Planos e preços" }]));
  });
});
