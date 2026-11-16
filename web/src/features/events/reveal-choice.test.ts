import { describe, expect, it } from "vitest";
import { epochToZoned, zonedToEpoch } from "@/domain/reveal";
import { resolveReveal } from "./reveal-input";
import { buildRevealInput } from "./reveal-choice";
import { revealOptions } from "./wizard-time";

const base = (tz: string) => ({ date: "", time: "", timezone: tz });

describe.each(["America/Cuiaba", "America/Sao_Paulo", "Europe/Lisbon"])("opções de revelação em %s", (TZ) => {
  const NOW = zonedToEpoch("2027-03-14", "15:00", TZ);
  const END = zonedToEpoch("2027-03-15", "02:00", TZ); // festa que vira a meia-noite
  it("lista quatro opções, na ordem do desenho", () => {
    expect(revealOptions(END, TZ).map((o) => o.label)).toEqual(["Quando a festa acabar", "No dia seguinte", "Um dia depois", "Escolher dia e hora"]);
  });
  it("Quando a festa acabar = fim; No dia seguinte = próximo meio-dia; Um dia depois = fim + 1 dia civil", () => {
    const [a, m, u] = revealOptions(END, TZ);
    expect(a.at).toBe(END);
    expect(epochToZoned(m.at!, TZ)).toEqual({ date: "2027-03-15", time: "12:00" });
    expect(epochToZoned(u.at!, TZ)).toEqual({ date: "2027-03-16", time: "02:00" });
  });
  it("fim depois do meio-dia: 'No dia seguinte' vai para o meio-dia do outro dia", () => {
    const late = zonedToEpoch("2027-03-14", "23:30", TZ);
    expect(epochToZoned(revealOptions(late, TZ)[1].at!, TZ)).toEqual({ date: "2027-03-15", time: "12:00" });
  });
  it.each(["ao-acabar", "manha", "um-dia"] as const)("%s resolve para o instante mostrado", (id) => {
    const want = revealOptions(END, TZ).find((o) => o.id === id)!.at!;
    const r = resolveReveal(buildRevealInput(id, END, base(TZ)), END, NOW);
    expect(r.ok && r.enabled && r.at).toBe(want);
  });
  it("Escolher dia e hora usa a data e a hora digitadas no fuso", () => {
    const r = resolveReveal(buildRevealInput("dia", END, { date: "2027-03-16", time: "20:00", timezone: TZ }), END, NOW);
    expect(r.ok && r.enabled && r.at).toBe(zonedToEpoch("2027-03-16", "20:00", TZ));
  });
});
