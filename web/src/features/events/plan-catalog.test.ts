import { beforeEach, describe, expect, it } from "vitest";
import type { PublicPlan } from "@/features/billing/types";
import { clearPendingCode, hasPaidPlans, lowestPaidPrice, paidPlans, planForShots, poseNotice, poseOption, poseOptions, readPendingCode, savePendingCode, freeShots } from "./plan-catalog";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const ALL = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900), P("grande", "Grande", 500, null, 34900)];
const ONLY_FREE = [ALL[0]];

describe("plan-catalog (tudo vem do catálogo recebido)", () => {
  it("paidPlans / hasPaidPlans", () => {
    expect(paidPlans(ALL).map((p) => p.code)).toEqual(["festa", "celebracao", "casamento", "grande"]);
    expect(hasPaidPlans(ALL)).toBe(true);
    expect(hasPaidPlans(ONLY_FREE)).toBe(false);
  });
  it("lowestPaidPrice devolve o menor preço pago, ou undefined sem pagos", () => {
    expect(lowestPaidPrice(ALL)).toBe(2900);
    expect(lowestPaidPrice(ONLY_FREE)).toBeUndefined();
  });
  it("freeShots é o limite de fotos do Grátis do catálogo", () => {
    expect(freeShots(ALL)).toBe(10);
  });
  it("planForShots: até o limite do Grátis não pede plano; acima, o plano pago mais barato que comporta", () => {
    expect(planForShots(ALL, 10)).toBeUndefined();
    expect(planForShots(ALL, 16)?.code).toBe("festa");
    expect(planForShots(ALL, 36)?.code).toBe("casamento");
    expect(planForShots(ALL, null)?.code).toBe("grande");
  });
  it("sem plano pago ativo, nenhuma opção ganha selo", () => {
    expect(planForShots(ONLY_FREE, 36)).toBeUndefined();
  });
});

describe("código pendente de /c/<código>", () => {
  beforeEach(() => sessionStorage.clear());
  it("guarda normalizado e lê; limpa", () => {
    savePendingCode("mmt 7kq4 ab12");
    expect(readPendingCode()).toBe("MMT-7KQ4-AB12");
    clearPendingCode();
    expect(readPendingCode()).toBeNull();
  });
  it("ignora lixo vazio", () => {
    savePendingCode("   ");
    expect(readPendingCode()).toBeNull();
  });
});

const brl = (c: number) => (c % 100 === 0 ? `R$ ${c / 100}` : `R$ ${(c / 100).toFixed(2).replace(".", ",")}`);
const CAT = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 50, 24, 5990), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900), P("grande", "Grande", 500, null, 34900)];

describe("opções do passo Poses a partir do catálogo", () => {
  it("10, 24, 36 e Livre só se algum plano pago não tem limite; nunca 27", () => {
    expect(poseOptions(CAT)).toEqual([10, 24, 36, null]);
    expect(poseOptions(CAT.slice(0, 4))).toEqual([10, 24, 36]);
    expect(poseOptions([CAT[0]])).toEqual([10, 24, 36]);
  });
  it("legenda: Grátis, 'a partir de' com o plano mais barato que comporta (planForShots), ou 'indisponível'", () => {
    expect(poseOption(CAT, 10, brl)).toEqual({ n: 10, caption: "Grátis" });
    expect(poseOption(CAT, 24, brl).caption).toBe("a partir de R$ 59,90");
    expect(poseOption(CAT, 36, brl).caption).toBe("a partir de R$ 189");
    expect(poseOption(CAT, null, brl).caption).toBe("a partir de R$ 349");
    expect(poseOption([CAT[0]], 24, brl).caption).toBe("indisponível");
  });
  it("aviso de troca de plano só acima do Grátis e com plano que comporta", () => {
    expect(poseNotice(CAT, 10)).toBeNull();
    expect(poseNotice(CAT, 24)).toBe("Isso muda seu plano para Festa.");
    expect(poseNotice(CAT, 36)).toBe("Isso muda seu plano para Casamento.");
    expect(poseNotice(CAT, null)).toBe("Isso muda seu plano para Grande.");
    expect(poseNotice([CAT[0]], 36)).toBeNull();
  });
});
