import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseRepositories } from "@/repositories/supabase";
import { createMemoryRepositories } from "@/repositories";
import { CODE, EVENT, GUEST, HOST, fakeSupabase, measure } from "@/perf/fake-supabase";
import { readEventScoped } from "./read";

const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const actor = (userId: string | null) => ({ userId, role: "organizador" as const });

describe("readEventScoped: idas ao servidor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("convidado: o evento e depois todo o resto num único lote (2 idas em série)", async () => {
    const { sb, calls } = fakeSupabase({ me: GUEST });
    const m = await measure(adv, () => readEventScoped(createSupabaseRepositories(sb), { code: CODE }, actor(GUEST), 10_000));
    expect(m.value.access).toBe("membro");
    expect(m.value.photos).toHaveLength(20);
    expect(m.serial).toBe(2);
    expect(calls.length).toBe(6);
  });

  it("anfitrião: não consulta a própria participação (2 idas em série, 5 chamadas)", async () => {
    const { sb, calls } = fakeSupabase({ me: HOST });
    const m = await measure(adv, () => readEventScoped(createSupabaseRepositories(sb), { id: EVENT }, actor(HOST), 10_000));
    expect(m.value.access).toBe("organizador");
    expect(m.serial).toBe(2);
    expect(calls.map((c) => c.what).filter((w) => w.startsWith("participants:") && w.includes("maybeSingle"))).toEqual([]);
    expect(calls.length).toBe(5);
  });
});

describe("readEventScoped: quem não é membro continua só com a prévia", () => {
  it("dados lidos em paralelo são descartados quando a pessoa ainda está no convite", async () => {
    const r = createMemoryRepositories();
    await r.events.save({
      id: "e1", code: "ABCD2345", title: "Festa", category: "casamento", hostId: "host", hostName: "Ana", startAt: 0, durationHours: 6,
      cameraStyle: "original", revealEnabled: false, revealAt: null, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, version: 1, timezone: "UTC", revealStatus: "desativada", capacity: 50, shotsPerPerson: 24,
      everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt: 0,
    });
    await r.photos.add({ id: "p1", eventId: "e1", authorId: "host", authorName: "Ana", createdAt: 1, moment: "Agora", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta" }, { bytes: new ArrayBuffer(1), type: "image/jpeg" });
    await r.participants.put({ eventId: "e1", userId: "bia", name: "Bia", joinedAt: 1 });
    await r.reactions.put({ eventId: "e1", photoId: "p1", authorId: "bia", kind: "amei" });
    for (const who of ["estranho", null]) {
      const v = await readEventScoped(r, { code: "ABCD2345" }, actor(who), 10);
      expect(v.access).toBe("convite");
      expect(v.event).toBeUndefined();
      expect(v.photos).toEqual([]);
      expect(v.participants).toEqual([]);
      expect(v.reactions).toEqual([]);
      expect(v.counts).toEqual({ mine: 0, total: 0 });
      expect(v.preview?.title).toBe("Festa");
    }
    // o servidor recusa as contagens de quem não é membro: a recusa vinda do lote não vira erro na tela do convite
    r.events.counts = async () => { throw Object.assign(new Error("forbidden"), { code: "forbidden" }); };
    expect((await readEventScoped(r, { code: "ABCD2345" }, actor("estranho"), 10)).access).toBe("convite");
    // já para um membro, a falha aparece (a tela decide se mostra erro ou mantém o que tinha)
    await expect(readEventScoped(r, { code: "ABCD2345" }, actor("bia"), 10)).rejects.toThrow("forbidden");
  });
});
