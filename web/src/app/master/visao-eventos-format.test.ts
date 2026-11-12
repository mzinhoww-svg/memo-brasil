import { describe, expect, it } from "vitest";
import { auditLine, barsOf, eventSpan, failureSpike, monthCaption, stamp, weekdayDay, windowFromDays } from "./visao-eventos-format";

describe("formatos da Visão geral e do detalhe do evento (fuso de Cuiabá)", () => {
  it("dia da série, carimbo e legenda do mês", () => {
    expect(weekdayDay("2026-11-10")).toBe("ter, 10 nov");
    expect(stamp("2026-11-03T13:14:00Z")).toBe("03 nov 2026 09:14");
    expect(monthCaption(new Date("2026-11-12T12:42:00Z"))).toBe("Novembro de 2026 · atualizado às 08:42");
  });
  it("faixa do evento: o fim leva o dia da semana quando cai em outro dia", () => {
    expect(eventSpan("2027-03-14T20:30:00Z", "2027-03-15T06:00:00Z")).toBe("dom, 14 mar 2027 16:30 → seg 02:00");
    expect(eventSpan("2027-03-14T20:30:00Z", "2027-03-14T23:00:00Z")).toBe("dom, 14 mar 2027 16:30 → 19:00");
  });
  it("janela de N dias começa à meia-noite de Cuiabá, N-1 dias atrás", () => {
    expect(windowFromDays(7, new Date("2026-11-12T15:00:00Z")).from).toBe("2026-11-06T04:00:00.000Z");
    expect(windowFromDays(30, new Date("2026-11-12T15:00:00Z")).from).toBe("2026-10-14T04:00:00.000Z");
  });
});

describe("barras do gráfico", () => {
  it("altura relativa ao maior; só a primeira maior barra fica em destaque; rótulo a cada 5", () => {
    const b = barsOf([1, 2, 0, 3, 2, 3]);
    expect(b.map((x) => x.pct)).toEqual([33, 67, 0, 100, 67, 100]);
    expect(b.map((x) => !!x.on)).toEqual([false, false, false, true, false, false]);
    expect(b[4].label).toBe("5");
    expect(b[0].label).toBeUndefined();
  });
  it("sem atividade: tudo em 0% e nada em destaque", () => {
    expect(barsOf([0, 0, 0]).every((x) => x.pct === 0 && !x.on)).toBe(true);
  });
  it("falha do dia fora do normal: pelo menos 10 e o dobro da média", () => {
    const f = [4, 5, 21, 6, 4, 3, 5];
    expect(f.map((v) => failureSpike(v, f))).toEqual([false, false, true, false, false, false, false]);
    expect(failureSpike(9, [1, 1, 1, 9])).toBe(false);
  });
});

describe("auditLine: linha do tempo da auditoria do evento", () => {
  it("rótulo em português, tom e quem agiu", () => {
    const l = auditLine({ at: "2026-11-03T13:14:00Z", action: "admin.soft_delete_test_events", actorRole: "master", actorName: "Marcos", reason: "limpeza" });
    expect(l.title).toBe("Evento de teste excluído");
    expect(l.tone).toBe("bad");
    expect(l.meta).toMatch(/Marcos \(master\)$/);
  });
  it("ação sem rótulo mostra o código; sem nome, o papel", () => {
    const l = auditLine({ at: "2026-11-03T13:14:00Z", action: "algo.novo", actorRole: "sistema", actorName: null, reason: null });
    expect(l.title).toBe("algo.novo");
    expect(l.meta).toMatch(/· sistema$/);
  });
});
