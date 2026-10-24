import { describe, expect, it } from "vitest";
import { codeTemplates, expiryInDays, usageRatio, validityText } from "./lib";

describe("codeTemplates", () => {
  it("devolve os três modelos com os planos", () => {
    const t = codeTemplates([{ code: "a", name: "A" }, { code: "b", name: "B" }]);
    expect(t.map((x) => x.id)).toEqual(["teste", "parceiro", "presente"]);
    expect(t.map((x) => x.plan)).toEqual(["a", "b", "a"]);
    expect(t.every((x) => x.uses >= 1 && x.days >= 1 && x.note.length >= 3)).toBe(true);
  });
  it("com um plano só, parceiro usa o mesmo; sem plano, vazio", () => {
    expect(codeTemplates([{ code: "a", name: "A" }])[1].plan).toBe("a");
    expect(codeTemplates([])[0].plan).toBe("");
  });
});

describe("expiryInDays", () => {
  it("conta no fuso de Cuiabá", () => {
    expect(expiryInDays(7, new Date("2026-10-23T02:00:00Z"))).toBe("2026-10-29");
    expect(expiryInDays(7, new Date("2026-10-23T12:00:00Z"))).toBe("2026-10-30");
  });
});

describe("validityText", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  it("descreve o prazo", () => {
    expect(validityText("2026-10-23T23:59:59-04:00", now)).toBe("vence hoje");
    expect(validityText("2026-10-24T23:59:59-04:00", now)).toBe("vence amanhã");
    expect(validityText("2026-11-22T23:59:59-04:00", now)).toBe("30 dias restantes");
    expect(validityText("2026-10-20T12:00:00Z", now)).toBe("venceu há 3 dias");
    expect(validityText("x", now)).toBe("—");
  });
});

describe("usageRatio", () => {
  it("limita entre 0 e 1", () => {
    expect(usageRatio(1, 4)).toBe(0.25);
    expect(usageRatio(9, 4)).toBe(1);
    expect(usageRatio(0, 0)).toBe(1);
  });
});
