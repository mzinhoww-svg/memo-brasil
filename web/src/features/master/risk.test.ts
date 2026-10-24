import { describe, expect, it } from "vitest";
import { eventRisk, sortByRisk, type RiskEvent } from "./risk";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const CAT = [30, 100, 300];
const base: RiskEvent = { status: "ativo", revealState: "pendente", revealAt: "2026-10-25T12:00:00Z", participants: 5, capacity: 100, hostName: "Ana", hostId: "h1" };
const codes = (e: Partial<RiskEvent>) => eventRisk({ ...base, ...e }, NOW, CAT).signals.map((s) => s.code);

describe("eventRisk", () => {
  it("evento saudável não tem sinais", () => expect(eventRisk(base, NOW, CAT)).toEqual({ score: 0, signals: [] }));
  it("ativo sem revelação programada", () => expect(codes({ revealState: "desativada", revealAt: null })).toEqual(["ativo_sem_revelacao"]));
  it("encerrado sem revelação não alerta", () => expect(codes({ status: "encerrado", revealState: "desativada", revealAt: null })).toEqual([]));
  it("ativo sem participante", () => expect(codes({ participants: 0 })).toEqual(["ativo_sem_participante"]));
  it("limite fora do catálogo (manual) é info", () => {
    const r = eventRisk({ ...base, capacity: 77 }, NOW, CAT);
    expect(r.signals).toEqual([{ code: "limite_fora_catalogo", severity: "info", label: "Limite de 77 fora do catálogo" }]);
  });
  it("capacidade nula não é fora de catálogo", () => expect(codes({ capacity: null })).toEqual([]));
  it("sem anfitrião é crítico", () => {
    const r = eventRisk({ ...base, hostName: " ", hostId: null }, NOW, CAT);
    expect(r.signals[0]).toMatchObject({ code: "sem_anfitriao", severity: "crit" });
  });
  it("revelação atrasada por estado ou por data vencida", () => {
    expect(codes({ revealState: "atrasada" })).toContain("revelacao_atrasada");
    expect(codes({ revealAt: "2026-10-22T00:00:00Z" })).toContain("revelacao_atrasada");
    expect(codes({ revealState: "revelada", revealAt: "2026-10-22T00:00:00Z" })).toEqual([]);
  });
  it("score soma pesos por severidade", () => {
    expect(eventRisk({ ...base, participants: 0 }, NOW, CAT).score).toBe(15);
    const r = eventRisk({ status: "ativo", revealState: "atrasada", participants: 0, capacity: 7 }, NOW, CAT);
    expect(r.score).toBe(40 + 40 + 15 + 5);
  });
});

describe("sortByRisk", () => {
  it("ordena por score decrescente e é estável", () => {
    const list = [{ n: "a", p: 5 }, { n: "b", p: 0 }, { n: "c", p: 0 }, { n: "d", p: 5 }];
    const out = sortByRisk(list, (x) => eventRisk({ ...base, participants: x.p }, NOW, CAT));
    expect(out.map((x) => x.n)).toEqual(["b", "c", "a", "d"]);
  });
});
