import { describe, expect, it } from "vitest";
import { excludeTestEvents, groupByEvent, inviteStats, visibleColumns, type Invite, type Part } from "./lib";

const p = (o: Partial<Part>): Part => ({ eventId: "e1", eventTitle: "A", name: "x", table: null, joinedAt: "2026-10-01", blocked: false, isHost: false, ...o });

describe("participantes/lib", () => {
  it("excludeTestEvents", () => {
    const items = [p({ eventId: "e1" }), p({ eventId: "e2" }), p({ eventId: undefined })];
    expect(excludeTestEvents(items, new Set(["e2"]))).toHaveLength(2);
    expect(excludeTestEvents(items, null)).toHaveLength(3);
  });
  it("groupByEvent conta, soma bloqueados e ordena", () => {
    const g = groupByEvent([p({ eventId: "e1", eventTitle: "B" }), p({ eventId: "e2", eventTitle: "A", blocked: true }), p({ eventId: "e2", eventTitle: "A" }), p({ eventId: "e3", eventTitle: "C" })]);
    expect(g.map((x) => [x.title, x.count, x.blocked])).toEqual([["A", 2, 1], ["B", 1, 0], ["C", 1, 0]]);
  });
  it("visibleColumns esconde colunas 100% vazias", () => {
    const rows = [{ a: "x", t: null, d: "—" }, { a: "y", t: "", d: "—" }];
    expect(visibleColumns(rows, ["a", "t", "d"])).toEqual(["a"]);
    expect(visibleColumns([...rows, { a: "z", t: "Mesa 3", d: "—" }], ["a", "t"])).toEqual(["a", "t"]);
    expect(visibleColumns(rows, ["a", "t"], ["t"])).toEqual(["a", "t"]);
    expect(visibleColumns([], ["a"])).toEqual([]);
  });
  it("inviteStats", () => {
    expect(inviteStats([]).rate).toBeNull();
    const inv: Invite[] = [
      { eventTitle: "A", label: "l", uses: 3, maxUses: null, state: "ativo", expiresAt: null },
      { eventTitle: "A", label: "m", uses: 0, maxUses: 5, state: "ativo", expiresAt: null },
      { eventTitle: "A", label: "n", uses: 2, maxUses: 2, state: "esgotado", expiresAt: null },
      { eventTitle: "A", label: "o", uses: 0, maxUses: null, state: "revogado", expiresAt: null },
    ];
    expect(inviteStats(inv)).toEqual({ total: 4, used: 2, entries: 5, rate: 0.5, active: 2 });
  });
});
