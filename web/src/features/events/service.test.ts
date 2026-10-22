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
