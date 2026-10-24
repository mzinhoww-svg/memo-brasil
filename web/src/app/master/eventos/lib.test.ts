import { describe, expect, it } from "vitest";
import { reasonError } from "../billing";
import { bulkInput, cleanHostName, deletableIds, toCatalog, detailFromList, eventParam, pageParam, parseIds, searchParam, statusParam, toEventDetail, toEventPage, toEventRow } from "./lib";

const ID = "11111111-2222-4333-8444-555555555555";
const ID2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("cleanHostName", () => {
  it("remove o prefixo repetido colado no fim", () => {
    expect(cleanHostName("Aurimar NogueiraAurimar")).toBe("Aurimar Nogueira");
  });
  it("remove o nome inteiro repetido, colado ou com espaço", () => {
    expect(cleanHostName("Ana SilvaAna Silva")).toBe("Ana Silva");
    expect(cleanHostName("Ana Silva Ana Silva")).toBe("Ana Silva");
  });
  it("mantém nomes legítimos", () => {
    for (const n of ["Aurimar Nogueira", "McDonald", "Lala", "Ana", "João Pedro", "Maria Maria", "DeAndre Jordan"]) expect(cleanHostName(n)).toBe(n);
  });
  it("vazio e nulo viram texto vazio; espaços são aparados", () => {
    expect(cleanHostName(null)).toBe("");
    expect(cleanHostName("  Ana   Paula ")).toBe("Ana Paula");
  });
});

describe("toEventRow / toEventPage", () => {
  it("normaliza item da RPC antiga: isTest desconhecido, nome limpo", () => {
    const r = toEventRow({ id: ID, title: "Festa", hostName: "Aurimar NogueiraAurimar", status: "ativo", participants: 3, capacity: 30 });
    expect(r.hostName).toBe("Aurimar Nogueira");
    expect(r.isTest).toBeNull();
    expect(r.planCode).toBeNull();
    expect(r.capacity).toBe(30);
  });
  it("normaliza item da RPC nova", () => {
    const p = toEventPage({ total: 1, items: [{ id: ID, title: "TESTE", hostName: "X", isTest: true, planCode: "festa", capacity: null }] });
    expect(p.total).toBe(1);
    expect(p.items[0]).toMatchObject({ isTest: true, planCode: "festa", capacity: null });
  });
  it("formato inválido vira página vazia", () => {
    expect(toEventPage(null)).toEqual({ total: 0, items: [] });
  });
});

describe("parâmetros", () => {
  it("status aceita só os três valores", () => {
    expect(statusParam({ status: "excluido" })).toBe("excluido");
    expect(statusParam({ status: "x" })).toBeNull();
  });
  it("página mínima 1, busca cortada em 80", () => {
    expect(pageParam({ p: "-3" })).toBe(1);
    expect(pageParam({ p: "4" })).toBe(4);
    expect(searchParam({ q: "  " })).toBeNull();
    expect(searchParam({ q: "a".repeat(100) })).toHaveLength(80);
  });
  it("ev só aceita uuid", () => {
    expect(eventParam({ ev: ID })).toBe(ID);
    expect(eventParam({ ev: "../x" })).toBeNull();
  });
});

describe("lote", () => {
  it("só eventos de teste não excluídos são selecionáveis para exclusão", () => {
    expect(deletableIds([{ id: "a", isTest: true, deletedAt: null }, { id: "b", isTest: false, deletedAt: null }, { id: "c", isTest: null, deletedAt: null }, { id: "d", isTest: true, deletedAt: "2026-01-01" }])).toEqual(["a"]);
  });
  it("parseIds valida uuid, remove duplicados e recusa vazio", () => {
    expect(parseIds(`${ID}, ${ID2},${ID}`)).toEqual([ID, ID2]);
    expect(parseIds("")).toBeNull();
    expect(parseIds(`${ID},nao-e-uuid`)).toBeNull();
    expect(parseIds(null)).toBeNull();
  });
  it("parseIds recusa mais de 500", () => {
    const many = Array.from({ length: 501 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`).join(",");
    expect(parseIds(many)).toBeNull();
  });
});

describe("toCatalog", () => {
  it("mapeia planos; sem limite não casa por capacidade", async () => {
    const { planLabel } = await import("@/features/master/plan");
    const cat = toCatalog([{ code: "festa", name: "Festa", maxGuests: 100, priceCents: 1 }, { code: "ilim", name: "Ilimitado", maxGuests: null, priceCents: 2 }]);
    expect(planLabel(100, null, cat)).toBe("Festa");
    expect(planLabel(42, null, cat)).toBe("manual (42)");
    expect(planLabel(null, "ilim", cat)).toBe("Ilimitado");
    expect(toCatalog(null)).toEqual([]);
  });
});

describe("bulkInput", () => {
  it("exige ids válidos e motivo de 10 a 500 caracteres", () => {
    expect(bulkInput("", "motivo suficiente", reasonError)).toEqual({ error: "Selecione de 1 a 500 eventos." });
    expect(bulkInput(ID, "curto", reasonError)).toHaveProperty("error");
    expect(bulkInput(ID, "  limpeza de testes antigos  ", reasonError)).toEqual({ ids: [ID], reason: "limpeza de testes antigos" });
  });
});

describe("detalhe", () => {
  it("ordena a linha do tempo e limpa nomes", () => {
    const d = toEventDetail({ event: { id: ID, title: "F", hostName: "A" }, timeline: [{ at: "2026-02-01", kind: "ended", label: "b" }, { at: "2026-01-01", kind: "created", label: "a" }], participants: [{ name: "Ana SilvaAna Silva", joinedAt: null, isHost: true }] });
    expect(d?.timeline.map((t) => t.kind)).toEqual(["created", "ended"]);
    expect(d?.participants[0].name).toBe("Ana Silva");
    expect(d?.orders).toEqual([]);
  });
  it("sem evento devolve null", () => {
    expect(toEventDetail({})).toBeNull();
  });
  it("fallback pela lista antiga", () => {
    expect(detailFromList({ total: 1, items: [{ id: ID, title: "F" }] }, ID)?.event.title).toBe("F");
    expect(detailFromList({ total: 0, items: [] }, ID)).toBeNull();
  });
});
