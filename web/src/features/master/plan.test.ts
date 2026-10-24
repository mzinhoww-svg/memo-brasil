import { describe, expect, it } from "vitest";
import { planLabel, pricePerGuestCents, type CatalogPlan } from "./plan";

const cat: CatalogPlan[] = [
  { code: "p30", name: "Encontro", capacity: 30, priceCents: 5900 },
  { code: "p100", name: "Festa", capacity: 100, priceCents: 14900 },
];

describe("planLabel", () => {
  it("usa o nome do plano pelo código", () => expect(planLabel(30, "p30", cat)).toBe("Encontro"));
  it("sem código, casa pela capacidade", () => expect(planLabel(100, null, cat)).toBe("Festa"));
  it("capacidade fora do catálogo é manual", () => expect(planLabel(77, null, cat)).toBe("manual (77)"));
  it("código desconhecido cai na capacidade", () => expect(planLabel(77, "zzz", cat)).toBe("manual (77)"));
  it("sem capacidade nem código", () => expect(planLabel(null, null, cat)).toBe("sem plano"));
});
describe("pricePerGuestCents", () => {
  it("divide e arredonda", () => { expect(pricePerGuestCents(cat[0])).toBe(197); expect(pricePerGuestCents(cat[1])).toBe(149); });
  it("capacidade zero devolve null", () => expect(pricePerGuestCents({ capacity: 0, priceCents: 100 })).toBeNull());
});
