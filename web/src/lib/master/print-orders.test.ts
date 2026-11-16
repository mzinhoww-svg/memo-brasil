import { describe, expect, it } from "vitest";
import { ADVANCE, buildTimeline, canCancel, formatAddress, formatPhone, isStatus, NEXT_STATUS, photosText, type PrintStatus } from "./print-orders";

describe("pedidos de impressão no Master", () => {
  it("o status só avança solicitado → em produção → enviado → entregue", () => {
    expect(NEXT_STATUS).toEqual({ solicitado: "em_producao", em_producao: "enviado", enviado: "entregue", entregue: null, cancelado: null });
    expect(Object.keys(ADVANCE)).toEqual(["em_producao", "enviado", "entregue"]);
  });
  it("cancelar vale só até o envio; entregue e cancelado são finais", () => {
    const can = (["solicitado", "em_producao", "enviado", "entregue", "cancelado"] as PrintStatus[]).filter(canCancel);
    expect(can).toEqual(["solicitado", "em_producao"]);
  });
  it("valida o filtro da URL", () => {
    expect(isStatus("enviado")).toBe(true);
    expect(isStatus("x")).toBe(false);
    expect(isStatus(undefined)).toBe(false);
  });
  it("telefone e endereço como no desenho", () => {
    expect(formatPhone("65998124077")).toBe("(65) 99812-4077");
    expect(formatPhone("6530000000")).toBe("(65) 3000-0000");
    expect(formatPhone("5565998124077")).toBe("(65) 99812-4077");
    expect(formatAddress({ street: "Rua das Mangueiras", number: "480", complement: "apto 62", neighborhood: "Jardim Itália", city: "Cuiabá", state: "MT", cep: "78060000" }))
      .toBe("Rua das Mangueiras, 480, apto 62 · Jardim Itália · Cuiabá, MT · 78060-000");
    expect(formatAddress({ street: "Rua Um", number: "1", complement: null, neighborhood: "Centro", city: "Cuiabá", state: "MT", cep: "78000000" })).toBe("Rua Um, 1 · Centro · Cuiabá, MT · 78000-000");
  });
  it("fotos no singular e no plural", () => {
    expect(photosText(1)).toBe("1 foto.");
    expect(photosText(48)).toBe("48 fotos.");
  });
  it("linha do tempo: pedido novo tem 1 passo feito e 3 por fazer", () => {
    const t = buildTimeline([{ status: "solicitado", at: "x", by: "Ana Ribeiro" }], () => "hoje 08:12");
    expect(t).toEqual([
      { tone: "ok", label: "Solicitado", caption: "hoje 08:12 · Ana Ribeiro" },
      { tone: "todo", label: "Em produção" }, { tone: "todo", label: "Enviado" }, { tone: "todo", label: "Entregue" },
    ]);
  });
  it("linha do tempo de pedido cancelado termina em Cancelado, com o motivo, sem passos por fazer", () => {
    const t = buildTimeline([
      { status: "solicitado", at: "a", by: "Ana" }, { status: "cancelado", at: "b", by: "Marcos", reason: "Pediu o cancelamento" },
    ], (i) => i);
    expect(t.map((s) => [s.tone, s.label])).toEqual([["ok", "Solicitado"], ["bad", "Cancelado"]]);
    expect(t[1].reason).toBe("Pediu o cancelamento");
  });
});
