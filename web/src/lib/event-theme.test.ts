import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/event-theme/contrast";
import type { PaletteId } from "@/domain/event";
import { ON_EVENTO, PALETTES, THEME_BASE, paletteCss } from "./event-theme";

// Regras de contraste do kit ("Camada do evento"): texto 4,5:1, controle 3:1.
describe.each(Object.keys(PALETTES) as PaletteId[])("paleta %s", (id) => {
  for (const theme of ["dia", "noite"] as const) {
    it(`cumpre os pares de contraste no tema ${theme}`, () => {
      const c = PALETTES[id][theme];
      const { fundo, tinta } = THEME_BASE[theme];
      expect(contrastRatio(tinta, c.superficie), "tinta sobre superfície").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.controle, fundo), "controle sobre fundo").toBeGreaterThanOrEqual(3);
      expect(contrastRatio(c.texto, fundo), "texto sobre fundo").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.texto, c.superficie), "texto sobre superfície").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ON_EVENTO[theme], c.texto), "on-evento sobre texto").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.profundo, fundo), "profundo sobre fundo").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.profundo, c.superficie), "profundo sobre superfície").toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("paletteCss", () => {
  it("gera um bloco por paleta e tema, sem tocar nos tokens de produto", () => {
    const css = paletteCss();
    for (const id of Object.keys(PALETTES)) expect(css).toContain(`[data-palette="${id}"]`);
    expect(css).not.toMatch(/--(acao|rec|tinta)\b/);
  });
});
