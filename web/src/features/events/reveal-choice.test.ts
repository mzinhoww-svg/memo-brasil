import { describe, expect, it } from "vitest";
import { epochToZoned, zonedToEpoch } from "@/domain/reveal";
import { resolveReveal } from "./reveal-input";
import { buildRevealInput, REVEAL_CHOICES } from "./reveal-choice";

const TZ = "America/Cuiaba";
const NOW = zonedToEpoch("2026-11-15", "18:00", TZ);
const END = zonedToEpoch("2026-11-15", "23:30", TZ);
const base = { date: "", time: "", timezone: TZ };

describe("buildRevealInput", () => {
  it("lista as quatro opções do passo Quando", () => {
    expect(REVEAL_CHOICES.map((c) => c.label)).toEqual(["Na hora", "Quando acabar", "Na manhã seguinte (10h)", "Escolher dia"]);
  });
  it("Na hora desliga a revelação", () => {
    expect(buildRevealInput("na-hora", END, base).enabled).toBe(false);
  });
  it("Quando acabar ancora no fim do evento", () => {
    const r = resolveReveal(buildRevealInput("ao-acabar", END, base), END, NOW);
    expect(r).toMatchObject({ ok: true, enabled: true, at: END, anchor: "fim" });
  });
  it("Na manhã seguinte (10h) é o dia seguinte ao fim às 10h no fuso do evento", () => {
    const r = resolveReveal(buildRevealInput("manha", END, base), END, NOW);
    expect(r.ok && r.enabled && r.at).toBe(zonedToEpoch("2026-11-16", "10:00", TZ));
  });
  it("manhã seguinte vira o dia certo mesmo quando o fim passa da meia-noite no fuso", () => {
    const endLate = zonedToEpoch("2026-11-16", "01:30", TZ); // fim já na madrugada
    const r = resolveReveal(buildRevealInput("manha", endLate, base), endLate, NOW);
    expect(r.ok && r.enabled && epochToZoned(r.at, TZ)).toEqual({ date: "2026-11-17", time: "10:00" });
  });
  it("manhã seguinte respeita o fuso (mesmo instante, fuso diferente, outro dia civil)", () => {
    const tokyo = "Asia/Tokyo";
    const r = resolveReveal(buildRevealInput("manha", END, { ...base, timezone: tokyo }), END, NOW);
    expect(r.ok && r.enabled && epochToZoned(r.at, tokyo)).toEqual({ date: "2026-11-17", time: "10:00" });
  });
  it("Escolher dia usa data e hora digitadas", () => {
    const r = resolveReveal(buildRevealInput("dia", END, { date: "2026-11-20", time: "12:00", timezone: TZ }), END, NOW);
    expect(r.ok && r.enabled && r.at).toBe(zonedToEpoch("2026-11-20", "12:00", TZ));
  });
});
