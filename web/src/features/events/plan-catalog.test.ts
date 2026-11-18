import { beforeEach, describe, expect, it } from "vitest";
import type { PublicPlan } from "@/features/billing/types";
import { clearPendingCode, hasPaidPlans, lowestPaidPrice, paidPlans, readPendingCode, savePendingCode, freeShots } from "./plan-catalog";

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
});

describe("código pendente de /c/<código>", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
  it("sobrevive a outra aba (só o localStorage) e vale por 7 dias", () => {
    const t0 = 1_800_000_000_000;
    savePendingCode("mmt 7kq4 ab12", t0);
    sessionStorage.clear(); // o login do Google voltou noutra aba/navegador
    expect(readPendingCode(t0 + 6 * 24 * 3_600_000)).toBe("MMT-7KQ4-AB12");
    expect(readPendingCode(t0 + 8 * 24 * 3_600_000)).toBeNull();
  });
  it("lê o formato antigo (código puro na sessão)", () => {
    sessionStorage.setItem("mm-codigo-pendente", "MMT-AAAA-BBBB");
    expect(readPendingCode()).toBe("MMT-AAAA-BBBB");
  });
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
