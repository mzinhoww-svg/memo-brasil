import { describe, expect, it } from "vitest";
import { createEvent, type EventInput } from "./service";
import { buildCreateInput } from "./wizard-input";
import type { Repositories, User } from "@/repositories";
import type { MemoEvent } from "@/domain/event";

const host = { id: "u1", name: "Ana" } as User;
const form = { title: "Festa da Ana", category: "festa" as const, durationHours: 6, reveal: { enabled: false } as never, desiredShots: 36 as const };

describe("createEvent não envia capacity acima do grátis", () => {
  it("mesmo com 36 fotos escolhidas no passo Fotos, o evento sai com 10 convidados e 10 fotos", async () => {
    const saved: MemoEvent[] = [];
    const repos = { events: { getByCode: async () => null, save: async (e: MemoEvent) => (saved.push(e), e) } } as unknown as Repositories;
    const input: EventInput = buildCreateInput(form);
    expect(input.capacity).toBe(10);
    expect(input.shotsPerPerson).toBe(10);
    const r = await createEvent(repos, host, input, Date.now());
    expect(r.ok).toBe(true);
    expect(saved[0].capacity).toBe(10);
    expect(saved[0].shotsPerPerson).toBe(10);
  });
  it("identidade vai com os padrões atuais (estilo, paleta, fonte)", () => {
    const i = buildCreateInput(form);
    expect(i).toMatchObject({ cameraStyle: "original", palette: "salvia", eventFont: "birthstone", everyoneSeesAll: true });
  });
});
