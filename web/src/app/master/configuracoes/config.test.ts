import { describe, expect, it } from "vitest";
import { CARD_FLAG, CHECKOUT_FLAG, PIX_KEY, changesOf, fieldError, type ConfigState } from "./config";

const base: ConfigState = { pixMinutes: "15", card: false, checkout: true, settings: { support_email: "a@b.co", capacity_grace_pct: "10", support_phone: "", company_legal_name: "", company_cnpj: "" } };

describe("M14 · configurações", () => {
  it("validade do Pix: 5 a 1440 minutos inteiros", () => {
    for (const ok of ["5", "15", "1440"]) expect(fieldError(PIX_KEY, ok)).toBeNull();
    for (const bad of ["4", "1441", "", "7,5", "abc"]) expect(fieldError(PIX_KEY, bad)).toMatch(/5 a 1440/);
  });
  it("valida e-mail, folga e campos livres (vazio remove)", () => {
    expect(fieldError("support_email", "sem-arroba")).toBe("E-mail inválido.");
    expect(fieldError("support_email", "")).toBeNull();
    expect(fieldError("capacity_grace_pct", "101")).toMatch(/0 a 100/);
    expect(fieldError("capacity_grace_pct", "12")).toBeNull();
    expect(fieldError("company_legal_name", "x".repeat(121))).toMatch(/longo/);
  });
  it("sem mudança não há o que gravar", () => {
    expect(changesOf(base, { ...base })).toEqual([]);
  });
  it("o cartão nasce desligado e ligá-lo vira uma chave validapay_card", () => {
    expect(base.card).toBe(false);
    expect(changesOf(base, { ...base, card: true })).toEqual([expect.objectContaining({ kind: "flag", key: CARD_FLAG, value: true, from: "desligado", to: "ligado" })]);
  });
  it("só o que mudou, no valor que o servidor recebe", () => {
    const next: ConfigState = { ...base, pixMinutes: "30", checkout: false, settings: { ...base.settings, capacity_grace_pct: "20", support_phone: "(65) 99999-0000" } };
    const c = changesOf(base, next);
    expect(c.map((x) => x.key).sort()).toEqual([CHECKOUT_FLAG, PIX_KEY, "capacity_grace_pct", "support_phone"].sort());
    expect(c.find((x) => x.key === PIX_KEY)?.value).toBe(30);
    expect(c.find((x) => x.key === "capacity_grace_pct")?.value).toBe(20);
    expect(c.find((x) => x.key === "support_phone")?.value).toBe("(65) 99999-0000");
    expect(c.find((x) => x.key === CHECKOUT_FLAG)).toEqual(expect.objectContaining({ kind: "flag", value: false }));
  });
  it("campo apagado grava vazio (texto) ou zero (folga)", () => {
    const c = changesOf(base, { ...base, settings: { ...base.settings, support_email: "", capacity_grace_pct: "" } });
    expect(c.find((x) => x.key === "support_email")?.value).toBe("");
    expect(c.find((x) => x.key === "capacity_grace_pct")?.value).toBe(0);
  });
});
