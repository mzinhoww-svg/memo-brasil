import { describe, expect, it } from "vitest";
import { limitChoices } from "./limits";

const CAP = [5, 10, 20, 50, 100, 150, 200, null];
const SHOTS = [5, 10, 16, 24, 36, null];

describe("limitChoices", () => {
  it("corta opções acima do limite do plano e acrescenta o próprio limite", () => {
    expect(limitChoices(CAP, 10, 10, true)).toEqual([5, 10]);
    expect(limitChoices(CAP, 30, 10, true)).toEqual([5, 10, 20, 30]);
    expect(limitChoices(CAP, 250, 100, true)).toEqual([5, 10, 20, 50, 100, 150, 200, 250]);
  });
  it("sem limite (null) mantém todas, inclusive ilimitado", () => {
    expect(limitChoices(SHOTS, null, 24)).toEqual(SHOTS);
  });
  it("não acrescenta o limite quando extra é falso; sempre preserva o valor atual (evento legado)", () => {
    expect(limitChoices(SHOTS, 24, 24)).toEqual([5, 10, 16, 24]);
    expect(limitChoices(CAP, 10, 200, true)).toEqual([5, 10, 200]);
    expect(limitChoices(CAP, 10, null, true)).toEqual([5, 10, null]);
  });
});
