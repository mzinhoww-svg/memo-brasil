import { describe, expect, it } from "vitest";
import { actionLabel, actorText, auditCategory, auditHref, auditRow, pageList, rangeText, reasonSummary, targetText } from "./audit";

const NOW = new Date("2026-11-11T18:00:00Z"); // 14:00 em Cuiabá
describe("auditoria (M28)", () => {
  it("categorias: só as cinco do servidor; o resto vira 'todas'", () => {
    for (const c of ["participante", "consentimento", "revelacao", "admin", "pagamento", "todas"]) expect(auditCategory(c)).toBe(c);
    expect(auditCategory("inventada")).toBe("todas");
    expect(auditCategory(undefined)).toBe("todas");
  });
  it("ações em português; desconhecida aparece como o código", () => {
    expect(actionLabel("plan.price_changed")).toBe("Preço de plano alterado");
    expect(actionLabel("export.csv")).toBe("Exportação");
    expect(actionLabel("algo.novo")).toBe("algo.novo");
  });
  it("o ator é o e-mail que o servidor mandou (já mascarado para o auditor)", () => {
    expect(actorText({ actorId: "u", actorRole: "master", actorEmail: "m***@revela.app" })).toBe("m***@revela.app");
    expect(actorText({ actorId: null, actorRole: "sistema", actorEmail: null })).toBe("sistema");
    expect(actorText({ actorId: "12345678-aaaa", actorRole: "convidado", actorEmail: null })).toBe("conta 12345678…");
  });
  it("alvo: rótulo do servidor, exportação com linhas, evento, código", () => {
    expect(targetText({ action: "export.csv", targetType: "export", targetId: "pagamentos", exportRows: 74 })).toBe("Pagamentos · 74 linhas");
    expect(targetText({ action: "export.csv", targetType: "export", targetId: "auditoria", exportRows: 1 })).toBe("Auditoria · 1 linha");
    expect(targetText({ action: "plan.updated", targetType: "plan", targetId: "casamento", targetLabel: "Casamento" })).toBe("Casamento");
    expect(targetText({ action: "code.created", targetType: "code", targetId: "BUFFET-JARDIM" })).toBe("BUFFET-JARDIM");
    expect(targetText({ action: "reveal.released", targetType: "event", targetId: "x", eventTitle: "Ana & Leo" })).toBe("Ana & Leo");
    expect(targetText({ action: "x", targetType: null, targetId: null })).toBe("—");
  });
  it("resumo do motivo: uma linha de até 90 caracteres", () => {
    expect(reasonSummary(null)).toBe("—");
    expect(reasonSummary("  ")).toBe("—");
    expect(reasonSummary("a\n b")).toBe("a b");
    const s = reasonSummary("x".repeat(200));
    expect(s.length).toBe(90);
    expect(s.endsWith("…")).toBe(true);
  });
  it("linha: data de Cuiabá, ator, ação, alvo e motivo", () => {
    const r = auditRow({ id: 7, at: "2026-11-11T12:51:00Z", actorId: "u", actorRole: "master", actorEmail: "marcos@revela.app", action: "code.created", targetType: "code", targetId: "BUFFET-JARDIM", reason: "Parceria", }, NOW);
    expect(r).toEqual({ key: "7", when: "hoje 08:51", who: "marcos@revela.app", action: "Cortesia criada", target: "BUFFET-JARDIM", reason: "Parceria" });
    expect(auditRow({ id: 8, at: "2026-09-10T18:22:00Z", actorId: null, actorRole: "sistema", action: "reveal.released", targetType: null, targetId: null, reason: null }, NOW).when).toBe("10 set 14:22");
  });
  it("paginação: 1 2 3 … 78 e o texto do intervalo", () => {
    expect(pageList(1, 78)).toEqual([1, 2, 3, "…", 78]);
    expect(pageList(40, 78)).toEqual([1, 2, 3, "…", 39, 40, 41, "…", 78]);
    expect(pageList(1, 3)).toEqual([1, 2, 3]);
    expect(rangeText(1, 1932)).toBe("1–25 de 1.932 · 25 por página");
    expect(rangeText(78, 1932)).toBe("1.926–1.932 de 1.932 · 25 por página");
    expect(rangeText(1, 0)).toBe("0–0 de 0 · 25 por página");
  });
  it("links mantêm categoria e evento", () => {
    expect(auditHref({})).toBe("/master/auditoria");
    expect(auditHref({ cat: "todas", p: 1 })).toBe("/master/auditoria");
    expect(auditHref({ cat: "admin", evento: "e1", p: 3 })).toBe("/master/auditoria?cat=admin&evento=e1&p=3");
  });
});
