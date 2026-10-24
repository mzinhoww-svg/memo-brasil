import { describe, expect, it, vi } from "vitest";
import type { MemoEvent } from "@/domain/event";
import { createMemoryRepositories } from "@/repositories";
import { loadMyEvents } from "./my-events";

const HOUR = 3_600_000;
const NOW = 100 * HOUR;
const ev = (id: string, hostId: string, startAt: number, createdAt: number): MemoEvent => ({
  id, code: `C${id}`, title: `Festa ${id}`, category: "casamento", hostId, hostName: "x", startAt, durationHours: 6,
  cameraStyle: "original", revealEnabled: false, revealAt: null, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, version: 1, timezone: "UTC", revealStatus: "desativada", capacity: 50, shotsPerPerson: 24,
  everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt,
});

describe("loadMyEvents", () => {
  it("separa ativos e encerrados do organizador e nunca inclui eventos de terceiros", async () => {
    const r = createMemoryRepositories();
    await r.events.save(ev("velho", "u1", NOW - 50 * HOUR, 1));
    await r.events.save(ev("vivo", "u1", NOW - HOUR, 2));
    await r.events.save(ev("vivo2", "u1", NOW - 2 * HOUR, 3));
    await r.events.save(ev("alheio", "u2", NOW - HOUR, 4));
    await r.events.save(ev("convidado", "u3", NOW - HOUR, 5));
    await r.participants.put({ eventId: "convidado", userId: "u1", name: "Ana", joinedAt: 1 });

    const m = await loadMyEvents(r, "u1", NOW);
    expect(m.active.map((e) => e.id)).toEqual(["vivo2", "vivo"]);
    expect(m.ended.map((e) => e.id)).toEqual(["velho"]);
    expect(m.joined.map((e) => e.id)).toEqual(["convidado"]);
    expect([...m.active, ...m.ended, ...m.joined].some((e) => e.id === "alheio")).toBe(false);
  });

  it("usa listMine quando o adaptador oferece (servidor) e não baixa a lista inteira", async () => {
    const r = createMemoryRepositories();
    await r.events.save(ev("meu", "u1", NOW - HOUR, 1));
    const list = vi.spyOn(r.events, "list");
    r.events.listMine = async () => [await r.events.get("meu")].filter(Boolean) as MemoEvent[];
    const m = await loadMyEvents(r, "u1", NOW);
    expect(m.active.map((e) => e.id)).toEqual(["meu"]);
    expect(list).not.toHaveBeenCalled();
  });
});
