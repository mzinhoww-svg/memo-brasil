import { describe, expect, it } from "vitest";
import { basePlanCode, lookupPlans, packAsPlan, packByCode, packExtraShots, packForBase, planWithPack } from "./pose-packs";
import type { PosePack, PublicPlan } from "./types";

const plan = (code: string, name: string, g: number | null, s: number | null, cents: number): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: false, features: [] });
const pack = (base: string, over: Partial<PosePack> = {}): PosePack => ({ code: `${base}_36`, baseCode: base, name: `${base} + Mais poses`, maxGuests: 50, maxShots: 36, baseMaxShots: 24, priceCents: 7980, extraCents: 1990, available: true, ...over });
const FESTA = plan("festa", "Festa", 50, 24, 5990);

describe("pose-packs (planos-variante ocultos)", () => {
  it("só oferece o pacote à venda do plano-base", () => {
    const packs = [pack("festa"), pack("celebracao", { available: false })];
    expect(packForBase(packs, "festa")?.code).toBe("festa_36");
    expect(packForBase(packs, "celebracao")).toBeUndefined();
    expect(packForBase(packs, "casamento")).toBeUndefined();
    expect(packForBase([], "festa")).toBeUndefined();
  });
  it("reconhece o plano atual de quem comprou o pacote, mesmo desligado, e volta ao plano-base", () => {
    const packs = [pack("festa", { available: false })];
    expect(packByCode(packs, "festa_36")?.baseCode).toBe("festa");
    expect(basePlanCode(packs, "festa_36")).toBe("festa");
    expect(basePlanCode(packs, "casamento")).toBe("casamento");
  });
  it("busca por código inclui a variante; o catálogo visível não é alterado", () => {
    const visible = [FESTA];
    const all = lookupPlans(visible, [pack("festa")]);
    expect(all.map((p) => p.code)).toEqual(["festa", "festa_36"]);
    expect(visible).toHaveLength(1);
    expect(packAsPlan(pack("festa"))).toMatchObject({ code: "festa_36", maxShots: 36, priceCents: 7980, isFree: false });
  });
  it("plano atual com pacote mostra as poses e o preço do pacote; sem pacote não muda", () => {
    expect(planWithPack(FESTA, pack("festa"))).toMatchObject({ name: "Festa + Mais poses", maxShots: 36, priceCents: 7980, maxGuests: 50 });
    expect(planWithPack(FESTA, undefined)).toBe(FESTA);
    expect(packExtraShots(pack("festa"))).toBe(12);
  });
});
