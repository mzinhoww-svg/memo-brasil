import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, DEFAULT_SALES_WHATSAPP, SALES_WHATSAPP_TEXT, salesContactHref } from "./contact";
import { PRIVACY_TEXT } from "./legal-text";

describe("contato único", () => {
  it("coincide com o contato do texto legal v1", () => {
    expect(JSON.stringify(PRIVACY_TEXT)).toContain(CONTACT_EMAIL);
  });
});

describe("salesContactHref (festas acima de 300)", () => {
  const wa = (n: string) => `https://wa.me/${n}?text=${encodeURIComponent(SALES_WHATSAPP_TEXT)}`;
  const mail = (e: string) => `mailto:${e}?subject=${encodeURIComponent("Festa com mais de 300 convidados")}`;

  it("monta o link do WhatsApp com a mensagem pronta", () => {
    expect(salesContactHref("5565999990000")).toBe(wa("5565999990000"));
  });
  it("aceita o número com máscara (só os dígitos contam)", () => {
    expect(salesContactHref("+55 (65) 99622-7110")).toBe(wa("5565996227110"));
  });
  it("sem número válido, cai no e-mail (nunca wa.me/undefined)", () => {
    expect(salesContactHref("", "a@b.com")).toBe(mail("a@b.com"));
    expect(salesContactHref("abc", "a@b.com")).toBe(mail("a@b.com"));
    expect(salesContactHref("123", "a@b.com")).toBe(mail("a@b.com"));
    expect(salesContactHref("1234567890123456", "a@b.com")).toBe(mail("a@b.com"));
  });
  it("padrão do projeto: o WhatsApp de vendas", () => {
    expect(salesContactHref()).toBe(wa(DEFAULT_SALES_WHATSAPP));
    expect(DEFAULT_SALES_WHATSAPP).toBe("5565996227110");
  });
});
