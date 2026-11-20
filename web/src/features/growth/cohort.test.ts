import { describe, expect, it } from "vitest";
import { COHORT_PERIODS, formatGrowthCount, formatGrowthMoney, formatGrowthRate, parseCohortPeriod } from "./cohort";

describe("GF-01 · coorte e formatação", () => {
  it("permite somente períodos definidos e adota 30 dias como padrão", () => {
    expect(COHORT_PERIODS).toEqual([7, 30, 90]);
    expect(parseCohortPeriod("7")).toBe(7);
    expect(parseCohortPeriod("90")).toBe(90);
    expect(parseCohortPeriod()).toBe(30);
    expect(parseCohortPeriod("999")).toBe(30);
    expect(parseCohortPeriod("0")).toBe(30);
    expect(parseCohortPeriod("not-a-number")).toBe(30);
  });
  it("calcula taxas apenas com coortes coerentes", () => {
    expect(formatGrowthRate(2, 10)).toBe("20,0%");
    expect(formatGrowthRate(0, 2)).toBe("0,0%");
    expect(formatGrowthRate(0, 0)).toBe("—");
    expect(formatGrowthRate(3, 2)).toBe("—");
  });
  it("trata reais em centavos e sem converter evento em pedido", () => {
    expect(formatGrowthMoney(14700)).toMatch(/147,00/);
    expect(formatGrowthMoney(0)).toMatch(/0,00/);
    expect(formatGrowthCount(1234)).toMatch(/1.234/);
  });
});
