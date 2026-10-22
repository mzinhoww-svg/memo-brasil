import { describe, expect, it } from "vitest";
import { createEvent, type EventInput } from "./service";
import { RepositoryError, type Repositories, type User } from "@/repositories";

const input: EventInput = { title: "Festa", category: "festa", durationHours: 3, reveal: { enabled: false } as never, cameraStyle: "original", capacity: 10, shotsPerPerson: 5, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone-bounce" as never };
const host = { id: "u1", name: "Ana" } as User;
const repos = (save: () => Promise<never>) => ({ events: { getByCode: async () => null, save } }) as unknown as Repositories;

describe("createEvent", () => {
  it("falha de gravação no repositório vira resultado de erro, não exceção que trava a tela", async () => {
    const r = await createEvent(repos(() => Promise.reject(new RepositoryError("invalid", "new row violates check constraint"))), host, input, Date.now());
    expect(r.ok).toBe(false);
  });
});

import { createMemoryRepositories } from "@/repositories/memory";
import { updateSettings } from "./service";

describe("updateSettings hostName", () => {
  it("o anfitrião edita o nome que aparece no convite", async () => {
    const repos = createMemoryRepositories();
    const c = await createEvent(repos, host, { ...input, reveal: { enabled: false } as never }, Date.now());
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const r = await updateSettings(repos, c.event.id, { hostName: "Emy e Igor" });
    expect(r.ok && r.event.hostName).toBe("Emy e Igor");
    expect((await repos.events.get(c.event.id))?.hostName).toBe("Emy e Igor");
  });
});
