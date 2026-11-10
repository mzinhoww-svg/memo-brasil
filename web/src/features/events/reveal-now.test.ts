import { describe, expect, it, vi } from "vitest";
import { createMemoryRepositories } from "@/repositories/memory";
import { RepositoryError, type Repositories, type User } from "@/repositories";
import { createEvent, type EventInput } from "./service";
import { REVEAL_NOW_MESSAGES, revealNow } from "./reveal-now";

const host = { id: "u1", name: "Ana" } as User;
const input = (enabled: boolean): EventInput => ({ title: "Festa", category: "festa", durationHours: 3, reveal: (enabled ? { enabled: true, kind: "data", days: 1, date: "2099-01-01", time: "10:00", timezone: "America/Sao_Paulo" } : { enabled: false }) as never, cameraStyle: "original", capacity: 10, shotsPerPerson: 5, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone" });
const NOW = Date.UTC(2026, 10, 10, 12);

async function seed(enabled: boolean) {
  const repos = createMemoryRepositories();
  const c = await createEvent(repos, host, input(enabled), NOW);
  if (!c.ok) throw new Error("seed");
  return { repos, event: c.event };
}

describe("revealNow (modo local, mesma regra do servidor)", () => {
  it("revela na hora: grava revealedAt e o estado vira revelada", async () => {
    const { repos, event } = await seed(true);
    const r = await revealNow(repos, event, NOW);
    expect(r.ok).toBe(true);
    const saved = await repos.events.get(event.id);
    expect(saved?.revealedAt).toBe(NOW);
    expect(saved?.revealStatus).toBe("revelada");
  });
  it("recusa evento já revelado e não muda o horário", async () => {
    const { repos, event } = await seed(true);
    await revealNow(repos, event, NOW);
    const again = await revealNow(repos, event, NOW + 60_000);
    expect(again).toEqual({ ok: false, reason: "ja-revelado" });
    expect((await repos.events.get(event.id))?.revealedAt).toBe(NOW);
  });
  it("recusa evento sem revelação ligada", async () => {
    const { repos, event } = await seed(false);
    expect(await revealNow(repos, event, NOW)).toEqual({ ok: false, reason: "indisponivel" });
  });
  it("evento apagado no meio: inexistente", async () => {
    const { repos, event } = await seed(true);
    await repos.events.remove(event.id);
    expect(await revealNow(repos, event, NOW)).toEqual({ ok: false, reason: "inexistente" });
  });
});

describe("revealNow (servidor)", () => {
  const server = async (fail?: RepositoryError) => {
    const { repos, event } = await seed(true);
    const revealNowRpc = vi.fn(async () => { if (fail) throw fail; });
    const wired = { ...repos, events: { ...repos.events, revealNow: revealNowRpc } } as unknown as Repositories;
    return { wired, event, revealNowRpc };
  };
  it("chama a RPC única e não grava o evento pelo caminho de updateReveal", async () => {
    const { wired, event, revealNowRpc } = await server();
    const save = vi.spyOn(wired.events, "save");
    expect((await revealNow(wired, event, NOW)).ok).toBe(true);
    expect(revealNowRpc).toHaveBeenCalledExactlyOnceWith(event.id);
    expect(save).not.toHaveBeenCalled();
  });
  it.each([
    ["forbidden", "sem-permissao"],
    ["reveal-locked", "ja-revelado"],
    ["invalid", "indisponivel"],
    ["not-found", "inexistente"],
    ["unavailable", "erro"],
  ] as const)("traduz %s em %s", async (code, reason) => {
    const { wired, event } = await server(new RepositoryError(code, "x"));
    expect(await revealNow(wired, event, NOW)).toEqual({ ok: false, reason });
    expect(REVEAL_NOW_MESSAGES[reason].length).toBeGreaterThan(5);
  });
});
