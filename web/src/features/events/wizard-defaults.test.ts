import { describe, expect, it } from "vitest";
import { CAPACITY_OPTIONS, SHOTS_OPTIONS } from "@/domain/options";
import { WIZARD_DEFAULTS } from "./wizard-input";

describe("WIZARD_DEFAULTS", () => {
  it("nasce no limite do plano grátis (10 convidados / 10 fotos), selecionável nas opções", () => {
    expect(WIZARD_DEFAULTS).toEqual({ capacity: 10, shots: 10 });
    expect(CAPACITY_OPTIONS).toContain(WIZARD_DEFAULTS.capacity);
    expect(SHOTS_OPTIONS).toContain(WIZARD_DEFAULTS.shots);
  });
});
