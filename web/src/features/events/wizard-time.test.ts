import { describe, expect, it } from "vitest";
import { zonedToEpoch } from "@/domain/reveal";
import { defaultWindow, noticeLine, resolveWindow, shortWhen } from "./wizard-time";

const TZ = "America/Cuiaba";
const NOW = zonedToEpoch("2027-03-14", "12:00", TZ);

describe("janela da festa (passo 3)", () => {
  it("16:30 → 02:00 termina no dia seguinte (virada da meia-noite)", () => {
    const r = resolveWindow({ date: "2027-03-14", start: "16:30", end: "02:00", timezone: TZ }, NOW);
    expect(r).toMatchObject({ ok: true, endsNextDay: true, endDate: "2027-03-15" });
    if (r.ok) expect((r.endMs - r.startMs) / 3_600_000).toBe(9.5);
  });
  it("mesmo dia quando termina depois de começar", () => {
    const r = resolveWindow({ date: "2027-03-14", start: "14:00", end: "22:00", timezone: TZ }, NOW);
    expect(r).toMatchObject({ ok: true, endsNextDay: false, endDate: "2027-03-14" });
  });
  it("termina em menos de 30 min a partir de agora: recusa", () => {
    expect(resolveWindow({ date: "2027-03-14", start: "11:00", end: "12:10", timezone: TZ }, NOW)).toEqual({ ok: false, error: "curta" });
  });
  it("horário inválido: recusa", () => {
    expect(resolveWindow({ date: "", start: "16:30", end: "02:00", timezone: TZ }, NOW)).toEqual({ ok: false, error: "invalida" });
  });
  it("janela padrão começa em meia hora cheia e dura 6 h", () => {
    const w = defaultWindow(NOW + 7 * 60_000, TZ);
    expect(w.start).toBe("12:30");
    expect(w.end).toBe("18:30");
  });
  it("rótulos por extenso no fuso do evento", () => {
    const at = zonedToEpoch("2027-03-15", "12:00", TZ);
    expect(shortWhen(at, TZ)).toBe("seg 12:00");
    expect(noticeLine(at, TZ)).toBe("segunda-feira, 15 de março, às 12:00");
  });
});
