import { describe, expect, it } from "vitest";
import { planViews } from "./lib";

describe("planViews", () => {
  const plans = [
    { code: "gratis", name: "Grátis", maxGuests: 20, priceCents: 0, isFree: true },
    { code: "p100", name: "Até 100", maxGuests: 100, priceCents: 9900, isFree: false },
    { code: "ilim", name: "Sem limite", maxGuests: null, priceCents: 50000, isFree: false },
  ];
  it("calcula preço por convidado e cruza vendas", () => {
    const v = planViews(plans, [{ code: "p100", name: "Até 100", sales: 3, revenueCents: 29700 }]);
    expect(v[0]).toMatchObject({ perGuestCents: null, sales: 0, revenueCents: 0 });
    expect(v[1]).toMatchObject({ perGuestCents: 99, sales: 3, revenueCents: 29700 });
    expect(v[2].perGuestCents).toBeNull();
  });
});
