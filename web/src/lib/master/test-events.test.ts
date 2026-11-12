import { describe, expect, it, vi } from "vitest";
import { deleteTestEvents, outcomeOfError, parseRefusals, refusalSentence, setTestFlag } from "./test-events";

const DETAIL = JSON.stringify([
  { id: "e1", title: "Ana & Leo", code: "nottest", reason: "Não é evento de teste" },
  { id: "e2", title: "Teste checkout Pix", code: "paid", reason: "Tem pagamento confirmado em produção" },
]);

describe("parseRefusals: o motivo de cada evento vem do servidor (details do erro)", () => {
  it("lê o JSON da recusa", () => {
    expect(parseRefusals(DETAIL)).toEqual([
      { id: "e1", title: "Ana & Leo", code: "nottest", reason: "Não é evento de teste" },
      { id: "e2", title: "Teste checkout Pix", code: "paid", reason: "Tem pagamento confirmado em produção" },
    ]);
  });
  it("ignora o que não é a lista esperada", () => {
    for (const bad of [undefined, null, "", "texto solto", "{}", "[1, 2]", "[{\"id\":1}]", "[quebrado"]) expect(parseRefusals(bad)).toEqual([]);
  });
});

describe("outcomeOfError: tradução dos erros das RPCs", () => {
  it("MM005 com detalhe = lote recusado inteiro", () => {
    const o = outcomeOfError({ code: "MM005", message: "paid", details: DETAIL });
    expect(o).toMatchObject({ ok: false, kind: "refused" });
    expect(o.ok === false && o.kind === "refused" && o.refusals.map((r) => r.reason)).toEqual(["Não é evento de teste", "Tem pagamento confirmado em produção"]);
  });
  it("MM005 sem detalhe, MM004, MM011 e outros", () => {
    expect(outcomeOfError({ code: "MM005", message: "invalid" })).toEqual({ ok: false, kind: "invalid" });
    expect(outcomeOfError({ code: "MM004", message: "forbidden" })).toEqual({ ok: false, kind: "forbidden" });
    expect(outcomeOfError({ code: "MM011", message: "reasonrequired" })).toEqual({ ok: false, kind: "reason" });
    expect(outcomeOfError({ code: "500", message: "boom" })).toEqual({ ok: false, kind: "unknown" });
  });
});

describe("setTestFlag e deleteTestEvents chamam as RPCs certas", () => {
  it("marcar/desmarcar", async () => {
    const rpc = vi.fn(async () => ({ data: { ok: true, updated: 2 }, error: null }));
    expect(await setTestFlag(["a", "b"], true, "motivo bom aqui", rpc)).toEqual({ ok: true, count: 2 });
    expect(rpc).toHaveBeenCalledWith("admin_set_test_flag", { p_events: ["a", "b"], p_value: true, p_reason: "motivo bom aqui" });
  });
  it("excluir: recusa do servidor vira a lista por evento", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "MM005", message: "nottest", details: DETAIL } }));
    const o = await deleteTestEvents(["e1", "e2", "e3"], "limpeza da homologação", rpc);
    expect(rpc).toHaveBeenCalledWith("admin_soft_delete_test_events", { p_events: ["e1", "e2", "e3"], p_reason: "limpeza da homologação" });
    expect(o).toMatchObject({ ok: false, kind: "refused" });
  });
  it("excluir: sucesso conta os excluídos", async () => {
    const rpc = vi.fn(async () => ({ data: { ok: true, deleted: 3 }, error: null }));
    expect(await deleteTestEvents(["a", "b", "c"], "limpeza da homologação", rpc)).toEqual({ ok: true, count: 3 });
  });
});

describe("refusalSentence", () => {
  it("vira frase sobre o evento", () => {
    expect(refusalSentence("Tem pagamento confirmado em produção")).toBe("Este evento tem pagamento confirmado em produção.");
    expect(refusalSentence("Não é evento de teste")).toBe("Não é evento de teste.");
  });
});
