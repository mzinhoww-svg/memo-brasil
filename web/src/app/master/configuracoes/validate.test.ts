import { describe, expect, it } from "vitest";
import { EDITABLE_KEYS, flagDescription, formatCnpj, formatPhone, isEditableKey, isValidCnpj, isValidEmail, settingNote, settingText, validateSetting } from "./validate";

describe("CNPJ", () => {
  it("aceita CNPJ numérico válido com ou sem máscara", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });
  it("recusa dígito verificador errado, tamanho errado e repetidos", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-8")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("abc")).toBe(false);
  });
  it("aceita o CNPJ alfanumérico (exemplo da Receita) e recusa letra nos verificadores", () => {
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12abc34501de35")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-36")).toBe(false);
    expect(isValidCnpj("12ABC34501DE3A")).toBe(false);
  });
  it("formata", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
  });
});

describe("e-mail", () => {
  it("aceita endereços comuns", () => {
    expect(isValidEmail("suporte@memoriesmt.com.br")).toBe(true);
    expect(isValidEmail(" a.b+c@x.io ")).toBe(true);
  });
  it("recusa formatos inválidos", () => {
    for (const e of ["", "semarroba", "a@b", "a@@b.com", "a b@c.com", "a@-b.com", "a@b.c", "a@b..com"]) expect(isValidEmail(e)).toBe(false);
  });
});

describe("telefone", () => {
  it("formata celular, fixo, +55 e 0800", () => {
    expect(formatPhone("65999990000")).toBe("(65) 99999-0000");
    expect(formatPhone("(65) 3333-4444")).toBe("(65) 3333-4444");
    expect(formatPhone("+55 65 99999-0000")).toBe("(65) 99999-0000");
    expect(formatPhone("0800 123 4567")).toBe("0800 123 4567");
  });
  it("recusa sem DDD ou celular sem 9", () => {
    expect(formatPhone("99990000")).toBeNull();
    expect(formatPhone("65899990000")).toBeNull();
    expect(formatPhone("05999990000")).toBeNull();
  });
});

describe("chaves editáveis", () => {
  it("são só os quatro campos da empresa; payments_env nunca", () => {
    expect([...EDITABLE_KEYS].sort()).toEqual(["company_cnpj", "company_legal_name", "support_email", "support_phone"]);
    expect(isEditableKey("payments_env")).toBe(false);
    expect(isEditableKey("capacity_grace_pct")).toBe(false);
    expect(isEditableKey(undefined)).toBe(false);
    expect(validateSetting("payments_env", "production")).toEqual({ ok: false, error: "Este campo não pode ser alterado aqui." });
  });
});

describe("validateSetting", () => {
  it("normaliza valores válidos", () => {
    expect(validateSetting("company_cnpj", "11222333000181")).toEqual({ ok: true, value: "11.222.333/0001-81" });
    expect(validateSetting("support_email", "  suporte@x.com.br ")).toEqual({ ok: true, value: "suporte@x.com.br" });
    expect(validateSetting("support_phone", "65 99999 0000")).toEqual({ ok: true, value: "(65) 99999-0000" });
    expect(validateSetting("company_legal_name", "  Memories   MT  Ltda ")).toEqual({ ok: true, value: "Memories MT Ltda" });
  });
  it("recusa vazio e inválidos com mensagem", () => {
    expect(validateSetting("company_cnpj", " ")).toEqual({ ok: false, error: "Preencha o campo." });
    expect(validateSetting("company_cnpj", "11222333000182").ok).toBe(false);
    expect(validateSetting("support_email", "x@").ok).toBe(false);
    expect(validateSetting("company_legal_name", "AB").ok).toBe(false);
  });
});

describe("textos", () => {
  it("valor de configuração", () => {
    expect(settingText("abc")).toBe("abc");
    expect(settingText(null)).toBeNull();
    expect(settingText(" ")).toBeNull();
    expect(settingText(10)).toBe("10");
    expect(settingText({ a: 1 })).toBeNull();
  });
  it("nota de payments_env fala do procedimento de pagamentos", () => expect(settingNote("payments_env")).toMatch(/procedimento de pagamentos/));
  it("descrição de flag", () => {
    expect(flagDescription("nova_galeria", {})).toMatch(/Sem descrição/);
    expect(flagDescription("x", { description: "Galeria nova", percent: 10 })).toBe("Galeria nova; liberada para 10% das contas");
    expect(flagDescription("x", { emails: ["a"] })).toBe("regras: emails");
  });
});
