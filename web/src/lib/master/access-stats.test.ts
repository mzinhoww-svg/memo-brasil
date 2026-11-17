import { describe, expect, it } from "vitest";
import { countryName, mediumLabel, parsePeriod, perVisit, seriesBars, share } from "./access-stats";

describe("estatísticas de acesso · apresentação", () => {
  it("período: só 1, 7, 30 e 90; o resto cai em 7", () => {
    expect([parsePeriod("1"), parsePeriod("30"), parsePeriod("90")]).toEqual([1, 30, 90]);
    for (const v of [undefined, "", "5", "abc", "365", "-1"]) expect(parsePeriod(v)).toBe(7);
  });
  it("participação e páginas por visita", () => {
    expect(share(25, 100)).toBe("25%");
    expect(share(1, 3)).toBe("33%");
    expect(share(5, 0)).toBe("—");
    expect(perVisit(30, 20)).toBe("1,5");
    expect(perVisit(5, 0)).toBe("—");
  });
  it("barras: proporcionais ao maior dia, zero fica zero, hoje destacado, rótulos espaçados", () => {
    const s = Array.from({ length: 10 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, "0")}`, visitors: i === 4 ? 40 : i === 9 ? 10 : 0, views: i }));
    const b = seriesBars(s);
    expect(b).toHaveLength(10);
    expect(b[4].height).toBe(100);
    expect(b[9].height).toBe(25);
    expect(b[0].height).toBe(0);
    expect(b[9].on).toBe(true);
    expect(b.filter((x) => x.label).length).toBeLessThanOrEqual(10);
    expect(b[9].label).toBe("10"); // o último dia sempre tem rótulo
    expect(b[4].title).toBe("05/11: 40 visitantes · 4 visualizações");
  });
  it("sem nenhum visitante as barras ficam todas zeradas (sem dividir por zero)", () => {
    expect(seriesBars([{ day: "2026-11-01", visitors: 0, views: 0 }]).map((x) => x.height)).toEqual([0]);
    expect(seriesBars([])).toEqual([]);
  });
  it("país por extenso e origem em português", () => {
    expect(countryName("BR")).toBe("Brasil");
    expect(countryName("--")).toBe("Não informado");
    expect(mediumLabel("orgânico")).toBe("Busca");
    expect(mediumLabel("social")).toBe("Rede social");
    expect(mediumLabel("outra")).toBe("outra");
  });
});
