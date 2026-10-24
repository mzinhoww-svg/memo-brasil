import { describe, expect, it } from "vitest";
import { monthKey, monthLabel, monthlyHistory, slaOf, sortBySla, type LgpdItem } from "./lib";

const it_ = (o: Partial<LgpdItem>): LgpdItem => ({ userId: "u", requestedAt: "2026-10-01T12:00:00Z", processedAt: null, status: "pendente", daysOpen: 3, overdue: false, ...o });

describe("slaOf", () => {
  it("pendente no prazo / aviso / estourado", () => {
    expect(slaOf(it_({ daysOpen: 3 }), 15)).toEqual({ used: 3, max: 15, tone: "ok", late: false, done: false });
    expect(slaOf(it_({ daysOpen: 12 }), 15).tone).toBe("warn");
    expect(slaOf(it_({ daysOpen: 16, overdue: true }), 15)).toMatchObject({ tone: "crit", late: true });
    expect(slaOf(it_({ daysOpen: 5, overdue: true }), 15).late).toBe(true);
  });
  it("processado: dias até a conclusão; fora do prazo é crit", () => {
    expect(slaOf(it_({ processedAt: "2026-10-04T12:00:00Z", daysOpen: null }), 15)).toMatchObject({ used: 3, tone: "ok", done: true, late: false });
    expect(slaOf(it_({ processedAt: "2026-10-20T12:00:00Z", daysOpen: null }), 15)).toMatchObject({ used: 19, tone: "crit", late: true });
  });
});
describe("sortBySla", () => {
  it("atrasadas, pendentes, processadas", () => {
    const a = it_({ userId: "a", daysOpen: 2 }), b = it_({ userId: "b", daysOpen: 20, overdue: true }), c = it_({ userId: "c", processedAt: "2026-10-02T00:00:00Z" }), d = it_({ userId: "d", daysOpen: 9 });
    expect(sortBySla([a, c, d, b], 15).map((x) => x.userId)).toEqual(["b", "d", "a", "c"]);
  });
});
describe("meses", () => {
  it("monthKey usa America/Cuiaba", () => {
    expect(monthKey("2026-11-01T02:00:00Z")).toBe("2026-10");
    expect(monthKey("2026-11-01T05:00:00Z")).toBe("2026-11");
    expect(monthLabel("2026-10")).toBe("out/26");
  });
  it("monthlyHistory preenche meses vazios e conta cada tipo", () => {
    const h = monthlyHistory([
      it_({ requestedAt: "2026-08-10T12:00:00Z", processedAt: "2026-08-12T12:00:00Z" }),
      it_({ requestedAt: "2026-08-20T12:00:00Z", processedAt: "2026-10-05T12:00:00Z" }),
      it_({ requestedAt: "2026-10-01T12:00:00Z", daysOpen: 22, overdue: true }),
    ], 15);
    expect(h.map((r) => [r.month, r.requested, r.processed, r.late])).toEqual([["2026-08", 2, 1, 1], ["2026-09", 0, 0, 0], ["2026-10", 1, 1, 1]]);
    expect(monthlyHistory([], 15)).toEqual([]);
  });
});
