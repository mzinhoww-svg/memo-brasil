import { describe, expect, it } from "vitest";
import { diffPlans, draftErrors, setHighlight, showValue, slugify, toChanges, type PlanRow } from "./prices";

const base: PlanRow[] = [
  { code: "gratis", name: "Grátis", maxGuests: 10, maxShots: 10, priceCents: 0, sandboxActive: true, productionActive: true, highlighted: false, isFree: true, sort: 0 },
  { code: "festa", name: "Festa", maxGuests: 30, maxShots: 24, priceCents: 2900, sandboxActive: true, productionActive: true, highlighted: false, isFree: false, sort: 1 },
  { code: "casamento", name: "Casamento", maxGuests: 250, maxShots: 36, priceCents: 18900, sandboxActive: true, productionActive: true, highlighted: true, isFree: false, sort: 3 },
];
const edit = (code: string, patch: Partial<PlanRow>) => base.map((p) => (p.code === code ? { ...p, ...patch } : p));

describe("prices", () => {
  it("sem alteração não há diferença nem payload", () => {
    expect(diffPlans(base, base)).toEqual([]);
    expect(toChanges(base, base)).toEqual([]);
  });
  it("mostra de → para só dos campos que mudaram", () => {
    const d = diffPlans(base, edit("festa", { priceCents: 3900, maxGuests: 40 }));
    expect(d).toHaveLength(1);
    expect(d[0].changes.map((c) => [c.field, c.from, c.to])).toEqual([["maxGuests", 30, 40], ["priceCents", 2900, 3900]]);
    expect(showValue("priceCents", 3900)).toBe("R$ 39,00");
    expect(showValue("maxShots", null)).toBe("sem limite");
  });
  it("destaque é um só: marcar troca o anterior", () => {
    const next = setHighlight(base, "festa");
    expect(next.filter((p) => p.highlighted).map((p) => p.code)).toEqual(["festa"]);
    const changes = toChanges(base, next).map((c) => [c.code, c.highlighted]);
    expect(changes).toEqual([["festa", true], ["casamento", false]]);
  });
  it("valida preço, limites, nome, código e duplicidade", () => {
    expect(draftErrors(edit("festa", { priceCents: 50 })).festa).toMatch(/R\$ 1,00/);
    expect(draftErrors(edit("festa", { maxGuests: 5000 })).festa).toMatch(/Convidados/);
    expect(draftErrors(edit("festa", { name: " " })).festa).toMatch(/nome/);
    expect(draftErrors(edit("gratis", { priceCents: 0 })).gratis).toBeUndefined();
    const novo: PlanRow = { code: "Bad Code", name: "X", maxGuests: 5, maxShots: 5, priceCents: 1000, sandboxActive: true, productionActive: false, highlighted: false, isFree: false, sort: 9, isNew: true };
    expect(draftErrors([...base, novo])["Bad Code"]).toMatch(/Código/);
    expect(draftErrors([...base, { ...novo, code: "festa" }]).festa).toBeTruthy();
  });
  it("plano novo entra com isNew e todos os campos", () => {
    const novo: PlanRow = { code: "mega", name: "Mega", maxGuests: 800, maxShots: null, priceCents: 49900, sandboxActive: true, productionActive: false, highlighted: false, isFree: false, sort: 9, isNew: true };
    expect(diffPlans(base, [...base, novo])[0].isNew).toBe(true);
    expect(toChanges(base, [...base, novo])).toEqual([{ code: "mega", name: "Mega", priceCents: 49900, maxGuests: 800, maxShots: null, sandboxActive: true, productionActive: false, highlighted: false, isNew: true }]);
  });
  it("slugify gera código válido", () => {
    expect(slugify("Super Festa 2027!")).toBe("super_festa_2027");
    expect(slugify("Pé de Valsa")).toBe("pe_de_valsa");
  });
  it("pacote Mais poses: nunca em destaque, sempre acima do preço do plano-base, e entra no payload de preços como os demais", () => {
    const pack: PlanRow = { code: "festa_36", name: "Festa + Mais poses", maxGuests: 30, maxShots: 36, priceCents: 4890, sandboxActive: true, productionActive: false, highlighted: false, isFree: false, sort: 1, packOf: "festa" };
    const withPack = [...base, pack];
    expect(draftErrors(withPack)).toEqual({});
    expect(draftErrors(withPack.map((p) => (p.code === "festa_36" ? { ...p, priceCents: 2900 } : p))).festa_36).toMatch(/precisa custar mais que Festa/);
    expect(draftErrors(withPack.map((p) => (p.code === "festa_36" ? { ...p, highlighted: true } : p))).festa_36).toMatch(/destaque/);
    // editar o preço do pacote publica só ele, pelo mesmo admin_publish_plans
    const edited = withPack.map((p) => (p.code === "festa_36" ? { ...p, priceCents: 5290 } : p));
    expect(toChanges(withPack, edited)).toEqual([expect.objectContaining({ code: "festa_36", priceCents: 5290, maxShots: 36 })]);
  });
});
