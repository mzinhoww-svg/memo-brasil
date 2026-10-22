import { describe, expect, it } from "vitest";
import { qrRollLine } from "./qr-copy";

const base = { shotsPerPerson: 10, revealEnabled: false, revealAt: null, timezone: "America/Cuiaba" } as const;

describe("qrRollLine (UXA-124)", () => {
  it("revela na hora quando a revelação programada está desligada", () => {
    expect(qrRollLine({ ...base })).toBe("Cada um tem 10 fotos. Revelamos na hora.");
  });
  it("usa singular com 1 foto", () => {
    expect(qrRollLine({ ...base, shotsPerPerson: 1 as never })).toBe("Cada um tem 1 foto. Revelamos na hora.");
  });
  it("diz 'Fotos sem limite' quando ilimitado", () => {
    expect(qrRollLine({ ...base, shotsPerPerson: null })).toBe("Fotos sem limite. Revelamos na hora.");
  });
  it("mostra dia e hora no fuso do evento quando programada", () => {
    const at = Date.UTC(2026, 11, 25, 23, 0); // 19h em Cuiabá (UTC-4)
    const line = qrRollLine({ ...base, revealEnabled: true, revealAt: at });
    expect(line).toBe("Cada um tem 10 fotos. Revelamos em 25 · 12 · 2026 às 19h00.");
  });
});
