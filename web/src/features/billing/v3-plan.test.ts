import { describe, expect, it } from "vitest";
import { guestsInput, isUpgrade, planSupports, recommendForGuests, salePlans } from "./v3-plan";
import type { PublicPlan } from "./types";

const p = (code: string, maxGuests: number, priceCents: number): PublicPlan => ({
  code, name: code, maxGuests, maxShots: 24, priceCents, isFree: priceCents === 0, features: [],
});
const plans = [p("gratis", 10, 0), p("festa", 30, 2900), p("celebracao", 100, 8900), p("casamento", 250, 18900), p("grande", 500, 34900), p("teste1real", 30, 100)];

describe("V3 — capacidade conforme catálogo real do servidor", () => {
  it("272 participantes exigem o plano de 500, sem inventar preço ou plano Premium", () => {
    expect(recommendForGuests(plans, 272)).toMatchObject({ code: "grande", maxGuests: 500, priceCents: 34900 });
  });
  it("o grátis REAL atende 10, não os 20 do conceito", () => {
    expect(recommendForGuests(plans, 10)?.code).toBe("gratis");
    expect(recommendForGuests(plans, 20)?.code).toBe("festa");
  });
  it("não recomenda plano de teste nem plano insuficiente", () => {
    expect(salePlans(plans).some((p) => p.code === "teste1real")).toBe(false);
    expect(recommendForGuests(plans, 501)).toBeNull();
  });
  it("preserva aumento de capacidade e upgrade real", () => {
    expect(planSupports(plans[3], 272)).toBe(false);
    expect(planSupports(plans[4], 272)).toBe(true);
    expect(isUpgrade(plans, "casamento", "grande")).toBe(true);
    expect(isUpgrade(plans, "grande", "casamento")).toBe(false);
  });
  it("não injeta valores inválidos no seletor", () => {
    expect(guestsInput("272")).toBe(272);
    expect(guestsInput("99999999")).toBe(30);
    expect(guestsInput("-2")).toBe(30);
    expect(guestsInput("um")).toBe(30);
  });
});
