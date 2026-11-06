import { describe, expect, it } from "vitest";
import { centsToReais, reaisToCents } from "./payment-money";

describe("money at the provider boundary", () => {
  it.each([[1, "0.01"], [10, "0.10"], [18900, "189.00"], [2147483647, "21474836.47"]])(
    "serializes %i cents to exact decimal %s", (cents, decimal) => {
      expect(centsToReais(cents)).toBe(decimal);
      expect(reaisToCents(decimal)).toBe(cents);
    },
  );
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648, Number.MAX_SAFE_INTEGER])(
    "rejects invalid charge cents %s", (value) => expect(() => centsToReais(value)).toThrow(),
  );
  it.each(["0.001", "1.999", "1e2", "-1", "", " 1.00", "1,00", "NaN", "21474836.48"])(
    "rejects unsafe reais %s instead of rounding", (value) => expect(() => reaisToCents(value)).toThrow(),
  );
  it("accepts zero for refund accounting but never creates a zero charge", () => {
    expect(reaisToCents("0.00")).toBe(0);
    expect(reaisToCents(0)).toBe(0);
    expect(() => centsToReais(0)).toThrow();
  });
  it("accepts JSON numeric amounts without floating point multiplication", () => {
    expect(reaisToCents(0.29)).toBe(29);
    expect(reaisToCents(189.9)).toBe(18990);
    expect(() => reaisToCents(0.1 + 0.2)).toThrow();
  });
});
