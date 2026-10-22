import { describe, expect, it } from "vitest";
import { suggestEventNames, hostFallbackName } from "./name-suggestions";

const D = Date.UTC(2026, 10, 15, 15); // 15/11/2026

describe("suggestEventNames", () => {
  it("gera exatamente 3 sugestões distintas a partir do tipo e do primeiro nome do anfitrião", () => {
    const s = suggestEventNames("casamento", "Ana Souza", D);
    expect(s).toHaveLength(3);
    expect(new Set(s).size).toBe(3);
    expect(s[0]).toBe("Casamento de Ana");
    expect(s.every((x) => x.length > 0 && x.length <= 60)).toBe(true);
  });
  it("muda com o tipo", () => {
    expect(suggestEventNames("festa", "Rui", D)[0]).toBe("Festa de Rui");
    expect(suggestEventNames("viagem", "Rui", D)[0]).toBe("Viagem de Rui");
  });
  it("sem nome do anfitrião não usa nome nenhum e continua com 3 sugestões", () => {
    const s = suggestEventNames("casamento", "  ", D);
    expect(s).toHaveLength(3);
    expect(new Set(s).size).toBe(3);
    expect(s.join(" ")).not.toMatch(/undefined|\bde\s*$/);
  });
  it("nome muito longo é cortado em 60 caracteres", () => {
    const s = suggestEventNames("empresa", "A".repeat(80), D);
    expect(s.every((x) => x.length <= 60)).toBe(true);
  });
});

describe("hostFallbackName", () => {
  it("usa o nome da conta e cai num padrão seguro quando vazio", () => {
    expect(hostFallbackName("  Ana Souza ")).toBe("Ana Souza");
    expect(hostFallbackName(undefined)).toBe("Organizador");
    expect(hostFallbackName("   ")).toBe("Organizador");
    expect(hostFallbackName("x".repeat(80))).toHaveLength(40);
  });
});
