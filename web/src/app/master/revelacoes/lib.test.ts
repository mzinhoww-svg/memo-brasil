import { describe, expect, it } from "vitest";
import { toEventRow } from "../eventos/lib";
import { byDay, revealTimeline } from "./lib";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const ev = (id: string, revealState: string, revealAt: string | null, extra: Record<string, unknown> = {}) => toEventRow({ id, title: id, hostName: "A", status: "ativo", revealState, revealAt, ...extra });

describe("revealTimeline", () => {
  it("atrasadas primeiro (mais antiga no topo), depois próximas (mais próxima no topo)", () => {
    const t = revealTimeline([
      ev("futura2", "pendente", "2026-10-25T00:00:00Z"),
      ev("atrasada2", "atrasada", "2026-10-22T00:00:00Z"),
      ev("futura1", "pendente", "2026-10-24T00:00:00Z"),
      ev("atrasada1", "atrasada", "2026-10-20T00:00:00Z"),
    ], NOW);
    expect(t.overdue.map((x) => x.row.id)).toEqual(["atrasada1", "atrasada2"]);
    expect(t.upcoming.map((x) => x.row.id)).toEqual(["futura1", "futura2"]);
  });
  it("pendente com horário vencido conta como atrasada", () => {
    expect(revealTimeline([ev("a", "pendente", "2026-10-23T11:00:00Z")], NOW).overdue).toHaveLength(1);
  });
  it("ignora reveladas, desativadas, sem horário e excluídas", () => {
    const t = revealTimeline([ev("r", "revelada", "2026-10-20T00:00:00Z"), ev("d", "desativada", null), ev("s", "pendente", null), ev("x", "pendente", "2026-10-24T00:00:00Z", { deletedAt: "2026-10-01" })], NOW);
    expect(t.overdue).toEqual([]);
    expect(t.upcoming).toEqual([]);
  });
});

describe("byDay", () => {
  it("agrupa itens consecutivos do mesmo dia local", () => {
    const t = revealTimeline([ev("a", "pendente", "2026-10-24T15:00:00Z"), ev("b", "pendente", "2026-10-24T18:00:00Z"), ev("c", "pendente", "2026-10-26T15:00:00Z")], NOW);
    const g = byDay(t.upcoming);
    expect(g).toHaveLength(2);
    expect(g[0].items.map((x) => x.row.id)).toEqual(["a", "b"]);
  });
});
