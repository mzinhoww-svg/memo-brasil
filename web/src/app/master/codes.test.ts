import { describe, expect, it } from "vitest";
import { MASTER_NAV } from "@/revela/master-icons";
import { codeLink, codeStatus, defaultExpiry, expiryIso, hintText, noteError, parseUses, usesText } from "./codes";

describe("códigos de cortesia (M3)", () => {
  it("mostra só o começo do código", () => {
    expect(hintText("MMT-7KQ4")).toBe("MMT-7KQ4-…");
  });
  it("usos no formato '{uses} de {max}'", () => {
    expect(usesText(1, 1)).toBe("1 de 1");
    expect(usesText(4, 20)).toBe("4 de 20");
  });
  it("status com rótulo e tom", () => {
    expect(codeStatus("ativo")).toEqual({ label: "ativo", tone: "ok" });
    expect(codeStatus("usado")).toEqual({ label: "usado", tone: "info" });
    expect(codeStatus("expirado")).toEqual({ label: "expirado", tone: "info" });
    expect(codeStatus("revogado")).toEqual({ label: "revogado", tone: "erro" });
  });
  it("validade padrão: hoje + 30 dias, como AAAA-MM-DD no fuso de Cuiabá", () => {
    expect(defaultExpiry(new Date("2026-10-22T15:00:00Z"))).toBe("2026-11-21");
    // 02:00 UTC ainda é dia 22 em Cuiabá (UTC-4)
    expect(defaultExpiry(new Date("2026-10-23T02:00:00Z"))).toBe("2026-11-21");
  });
  it("validade vale até o fim do dia escolhido em Cuiabá", () => {
    expect(expiryIso("2026-11-30")).toBe("2026-11-30T23:59:59-04:00");
    expect(expiryIso("30/11/2026")).toBeNull();
    expect(expiryIso("")).toBeNull();
  });
  it("usos: 1 a 1000, inteiro", () => {
    expect(parseUses("5")).toBe(5);
    expect(parseUses(" 1000 ")).toBe(1000);
    expect(parseUses("0")).toBeNull();
    expect(parseUses("1001")).toBeNull();
    expect(parseUses("2,5")).toBeNull();
    expect(parseUses("")).toBeNull();
  });
  it("nota obrigatória de 3 a 200 caracteres", () => {
    expect(noteError("  ab ")).toMatch(/pelo menos 3/);
    expect(noteError("x".repeat(201))).toMatch(/200/);
    expect(noteError("Teste · cerimonialista Júlia")).toBeNull();
  });
  it("link de resgate em /c/<código>", () => {
    expect(codeLink("https://memoriesmt.com.br", "MMT-7KQ4-XR2P")).toBe("https://memoriesmt.com.br/c/MMT-7KQ4-XR2P");
    expect(codeLink("http://localhost:3000/", "MMT-7KQ4-XR2P")).toBe("http://localhost:3000/c/MMT-7KQ4-XR2P");
  });
  it("console ganha o módulo Códigos", () => {
    expect(MASTER_NAV).toHaveLength(12);
    expect(MASTER_NAV).toEqual(expect.arrayContaining([expect.objectContaining({ id: "cortesias", label: "Cortesias" })]));
  });
});
