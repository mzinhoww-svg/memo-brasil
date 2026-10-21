import { describe, expect, it } from "vitest";
import { PALETTES } from "@/lib/event-theme";
import { contrastRatio, onColor } from "./contrast";
import { PRESETS, qrDarkColor, themeStyle, validateTheme, type ThemeSpec } from "./spec";

const base: ThemeSpec = { preset: "salvia", colors: { ...PRESETS.salvia.dia }, font: "birthstone", welcomeMessage: "Bem-vindos!", qrStyle: "classico" };

describe("contraste WCAG", () => {
  it("preto sobre branco é 21:1 e cinza igual é 1:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });
  it("onColor escolhe o texto com maior contraste", () => {
    expect(onColor("#101010")).toBe("#FFFFFF");
    expect(onColor("#F0F0F0")).toBe("#141211");
  });
});

describe("presets", () => {
  it.each(Object.keys(PRESETS))("preset %s passa nas regras de contraste em dia e noite", (id) => {
    for (const modo of ["dia", "noite"] as const) {
      const r = validateTheme({ ...base, preset: id, colors: { ...PRESETS[id][modo] } });
      expect(r.errors, `${id}/${modo}`).toEqual([]);
    }
  });
  it("os presets cobrem as paletas da v1", () => {
    for (const id of Object.keys(PALETTES)) expect(PRESETS).toHaveProperty(id);
  });
});

describe("validateTheme", () => {
  it("rejeita texto com contraste insuficiente sobre a superfície", () => {
    const r = validateTheme({ ...base, colors: { ...base.colors, texto: "#E0E8DC" } });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/texto/i);
  });
  it("rejeita cores fora de #RRGGBB (nada de css livre)", () => {
    for (const bad of ["red", "#fff", "url(javascript:alert(1))", "#12345g", "#E8ECE4; background:red"]) {
      expect(validateTheme({ ...base, colors: { ...base.colors, superficie: bad } }).ok, bad).toBe(false);
    }
  });
  it("rejeita fonte fora da lista, QR desconhecido e mensagem longa ou com controle", () => {
    expect(validateTheme({ ...base, font: "Comic Sans" as never }).ok).toBe(false);
    expect(validateTheme({ ...base, qrStyle: "x" as never }).ok).toBe(false);
    expect(validateTheme({ ...base, welcomeMessage: "a".repeat(281) }).ok).toBe(false);
    expect(validateTheme({ ...base, welcomeMessage: "oi\u0007" }).ok).toBe(false);
  });
});

describe("themeStyle: isolamento", () => {
  it("só emite variáveis do evento, nunca :root nem propriedades livres", () => {
    const s = themeStyle(base, "dia");
    for (const k of Object.keys(s)) expect(k).toMatch(/^--(evento-|on-evento|font-evento)/);
    expect(Object.keys(s)).toEqual(expect.arrayContaining(["--evento-superficie", "--evento-texto", "--on-evento"]));
  });
  it("dois eventos geram estilos independentes e a entrada inválida não vaza", () => {
    const a = themeStyle(base, "dia");
    const b = themeStyle({ ...base, preset: "oceano", colors: { ...PRESETS.oceano.dia } }, "dia");
    expect(a["--evento-superficie"]).not.toBe(b["--evento-superficie"]);
    expect(() => themeStyle({ ...base, colors: { ...base.colors, superficie: "red; x:y" } }, "dia")).toThrow();
  });
  it("on-evento é calculado para dar contraste ≥ 3 sobre o controle", () => {
    for (const id of Object.keys(PRESETS)) for (const m of ["dia", "noite"] as const) {
      const s = themeStyle({ ...base, preset: id, colors: { ...PRESETS[id][m] } }, m);
      expect(contrastRatio(String(s["--on-evento"]), String(s["--evento-controle"]))).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("qrDarkColor", () => {
  it("usa a cor de destaque só se o QR continuar legível (≥ 7:1 sobre branco); senão o preto padrão", () => {
    expect(qrDarkColor({ ...base, colors: { ...base.colors, profundo: "#102A43" } })).toBe("#102A43");
    expect(qrDarkColor({ ...base, colors: { ...base.colors, profundo: "#AAB4A2" } })).toBe("#1C1917");
    expect(qrDarkColor(undefined)).toBe("#1C1917");
  });
});
