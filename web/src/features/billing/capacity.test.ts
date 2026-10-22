import { describe, expect, it } from "vitest";
import { capacityState, graceSlots } from "./capacity";

describe("capacity", () => {
  it("graceSlots arredonda para cima como o servidor (ceil)", () => {
    expect(graceSlots(250, 10)).toBe(25);
    expect(graceSlots(10, 10)).toBe(1);
    expect(graceSlots(null, 10)).toBe(0);
    expect(graceSlots(30, 0)).toBe(0);
  });
  it("aviso a partir de 80% da capacidade, com limite = capacidade + folga", () => {
    expect(capacityState(212, 250, 10)).toEqual({ near: true, limit: 275 });
    expect(capacityState(199, 250, 10)).toEqual({ near: false, limit: 275 });
    expect(capacityState(8, 10, 10)).toEqual({ near: true, limit: 11 });
    expect(capacityState(500, null, 10)).toEqual({ near: false, limit: null });
  });
});
