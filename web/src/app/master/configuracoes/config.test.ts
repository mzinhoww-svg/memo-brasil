import { describe, expect, it } from "vitest";
import { EDIT, FLAG, fieldError, jsonOf, rawOf, viewOf, type ConfigOverview } from "./config";

const o: ConfigOverview = {
  paymentsEnv: "production",
  flags: { validapay_checkout: true, validapay_card: false, printed_album: false },
  settings: { pixMinutes: 15, supportEmail: "suporte@revela.app", supportPhone: null, companyLegalName: "Revela Ltda.", companyCnpj: null, capacityGracePct: 10 },
  webhook: { lastAt: "2026-11-11T12:42:00Z", pending: 0, failing: 0 },
};

describe("M31 · configurações", () => {
  it("validade do Pix: 5 a 1.440 minutos inteiros", () => {
    for (const ok of ["5", "15", "1440"]) expect(fieldError("pix", ok)).toBeNull();
    for (const bad of ["4", "1441", "", "7,5", "abc", "-5"]) expect(fieldError("pix", bad)).toMatch(/5 a 1\.440/);
  });
  it("valida e-mail, folga e campos livres (vazio remove, menos Pix e folga)", () => {
    expect(fieldError("support_email", "sem-arroba")).toBe("E-mail inválido.");
    expect(fieldError("support_email", "")).toBeNull();
    expect(fieldError("capacity_grace_pct", "101")).toMatch(/0 a 100/);
    expect(fieldError("capacity_grace_pct", "")).toMatch(/0 a 100/);
    expect(fieldError("capacity_grace_pct", "12")).toBeNull();
    expect(fieldError("company_legal_name", "x".repeat(121))).toMatch(/longo/);
    expect(fieldError("company_cnpj", "1".repeat(25))).toMatch(/longo/);
  });
  it("o servidor recebe número para Pix e folga e texto aparado para o resto", () => {
    expect(jsonOf("pix", " 30 ")).toBe(30);
    expect(jsonOf("capacity_grace_pct", "10")).toBe(10);
    expect(jsonOf("support_email", "  a@b.co ")).toBe("a@b.co");
    expect(jsonOf("company_cnpj", "")).toBe("");
  });
  it("mostra os valores de hoje e o ambiente (somente leitura)", () => {
    const v = viewOf(o, "https://x.supabase.co/functions/v1/payments-validapay-webhook", () => "hoje 08:42");
    expect(v.env).toEqual({ label: "Produção", tone: "ok" });
    expect(v.values).toMatchObject({ pix: "15 min", support_email: "suporte@revela.app", support_phone: "—", company_cnpj: "—", capacity_grace_pct: "10%" });
    expect(v.webhook).toMatchObject({ label: "Ativo", tone: "ok", meta: expect.stringContaining("último evento hoje 08:42") });
    expect(rawOf("pix", o)).toBe("15");
    expect(rawOf("support_phone", o)).toBe("");
  });
  it("webhook: sem eventos e com falhas", () => {
    expect(viewOf({ ...o, webhook: { lastAt: null, pending: 0, failing: 0 } }, "u", () => "").webhook).toMatchObject({ label: "Sem eventos", tone: "info" });
    expect(viewOf({ ...o, webhook: { lastAt: "x", pending: 2, failing: 1 } }, "u", () => "x").webhook).toMatchObject({ label: "Com falhas", tone: "bad" });
    expect(viewOf({ ...o, paymentsEnv: "qualquer" }, "u", () => "").env).toEqual({ label: "Desligado", tone: "info" });
  });
  it("toda chave e todo campo têm folha; desligar é vermelho e ligar é cheio", () => {
    expect(Object.keys(EDIT)).toHaveLength(6);
    for (const k of Object.keys(FLAG) as (keyof typeof FLAG)[]) {
      expect(FLAG[k].off.tone).toBe("danger");
      expect(FLAG[k].on.tone).toBe("primary");
    }
    expect(FLAG.validapay_checkout.off).toMatchObject({ title: "Desligar o checkout?", confirm: "Desligar checkout" });
  });
});
