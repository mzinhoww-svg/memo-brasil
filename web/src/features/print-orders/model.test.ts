import { describe, expect, it } from "vitest";
import { emptyShipping, formatCep, formatPhone, orderFromRow, orderSummary, validateDraft, type PrintDraft } from "./model";

const ok = (): PrintDraft => ({
  product: "album", quantity: 1, photoIds: ["a"], allPhotos: false, contactName: "Maria Souza", contactPhone: "65999991234", contactEmail: "",
  shipping: { cep: "78000000", street: "Rua das Flores", number: "10", neighborhood: "Centro", city: "Cuiabá", state: "MT" }, note: "",
});

describe("validação do pedido de impressão", () => {
  it("um pedido completo não tem erros", () => expect(validateDraft(ok())).toEqual({}));
  it("exige fotos (ou todas) e respeita o teto do produto", () => {
    expect(validateDraft({ ...ok(), photoIds: [] }).photos).toMatch(/pelo menos uma/);
    expect(validateDraft({ ...ok(), photoIds: [], allPhotos: true }).photos).toBeUndefined();
    expect(validateDraft({ ...ok(), product: "caixa", photoIds: Array.from({ length: 31 }, (_, i) => String(i)) }).photos).toMatch(/até 30/);
    expect(validateDraft({ ...ok(), product: "album", photoIds: Array.from({ length: 60 }, (_, i) => String(i)) }).photos).toBeUndefined();
  });
  it("quantidade de 1 a 10", () => {
    expect(validateDraft({ ...ok(), quantity: 0 }).quantity).toBeDefined();
    expect(validateDraft({ ...ok(), quantity: 11 }).quantity).toBeDefined();
    expect(validateDraft({ ...ok(), quantity: 1.5 }).quantity).toBeDefined();
  });
  it("precisa de telefone ou e-mail válido", () => {
    expect(validateDraft({ ...ok(), contactPhone: "", contactEmail: "" }).contact).toMatch(/telefone ou um e-mail/);
    expect(validateDraft({ ...ok(), contactPhone: "123" }).contact).toMatch(/DDD/);
    expect(validateDraft({ ...ok(), contactPhone: "", contactEmail: "sem-arroba" }).contact).toMatch(/e-mail/);
    expect(validateDraft({ ...ok(), contactPhone: "", contactEmail: "maria@exemplo.com" }).contact).toBeUndefined();
  });
  it("endereço: CEP de 8 números, UF de 2 letras e campos obrigatórios", () => {
    const e = validateDraft({ ...ok(), shipping: { ...emptyShipping(), cep: "123", state: "M" } });
    expect(Object.keys(e)).toEqual(expect.arrayContaining(["cep", "street", "number", "neighborhood", "city", "state"]));
    expect(validateDraft({ ...ok(), shipping: { ...ok().shipping, cep: "78000-000" } }).cep).toBeUndefined();
  });
  it("nome e observação com limite", () => {
    expect(validateDraft({ ...ok(), contactName: " A " }).contactName).toBeDefined();
    expect(validateDraft({ ...ok(), note: "x".repeat(501) }).note).toBeDefined();
  });
});

describe("formatação", () => {
  it("telefone e CEP", () => {
    expect(formatPhone("65999991234")).toBe("(65) 99999-1234");
    expect(formatPhone("6533334444")).toBe("(65) 3333-4444");
    expect(formatPhone("")).toBe("");
    expect(formatCep("78000000")).toBe("78000-000");
    expect(formatCep("78000")).toBe("78000");
  });
  it("resumo do pedido com singular e plural", () => {
    expect(orderSummary({ product: "album", quantity: 1, photoCount: 1, allPhotos: false })).toBe("1 álbum · 1 foto");
    expect(orderSummary({ product: "caixa", quantity: 2, photoCount: null, allPhotos: true })).toBe("2 caixas · todas as fotos");
  });
  it("linha do servidor vira pedido, com padrões seguros", () => {
    const o = orderFromRow({ id: "x", status: "inventado", product: "caixa", quantity: 2, photoCount: 5, allPhotos: false, createdAt: "2026-11-10T12:00:00Z", shipping: { cep: "78000000", state: "MT" }, mine: true });
    expect(o.status).toBe("solicitado");
    expect(o.product).toBe("caixa");
    expect(o.createdAt).toBe(Date.parse("2026-11-10T12:00:00Z"));
    expect(o.mine).toBe(true);
    expect(o.shipping.state).toBe("MT");
  });
});
