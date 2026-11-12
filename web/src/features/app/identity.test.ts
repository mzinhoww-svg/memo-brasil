import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRepositories } from "@/repositories";
import { createSupabaseRepositories } from "@/repositories/supabase";
import { GUEST, HOST, fakeSupabase, measure } from "@/perf/fake-supabase";
import { loadIdentity } from "./identity";
import { withWriteHook } from "./invalidate";

const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe("loadIdentity", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("na nuvem: 1 ida (perfil), sem auth.getUser; canCreate do mesmo resultado", async () => {
    const host = fakeSupabase({ me: HOST });
    const m = await measure(adv, () => loadIdentity(createSupabaseRepositories(host.sb), "supabase"));
    expect(m.value.user?.id).toBe(HOST);
    expect(m.value.canCreate).toBe(true);
    expect(host.calls.map((c) => c.what)).toEqual(["profiles:select.eq.maybeSingle"]);
    expect(m.serial).toBe(1);

    const guest = fakeSupabase({ me: GUEST });
    const g = await measure(adv, () => loadIdentity(createSupabaseRepositories(guest.sb), "supabase"));
    expect(g.value.user?.anonymous).toBe(true);
    expect(g.value.canCreate).toBe(false);
  });

  it("sem sessão na nuvem: ninguém, não cria; local: sempre cria", async () => {
    const sb = { auth: { getSession: async () => ({ data: { session: null }, error: null }) } };
    expect(await loadIdentity(createSupabaseRepositories(sb as never), "supabase")).toEqual({ user: undefined, known: [], canCreate: false });
    const r = createMemoryRepositories();
    await r.users.save({ id: "u1", name: "Ana", createdAt: 1 });
    expect(await loadIdentity(r, "local")).toMatchObject({ user: { id: "u1" }, canCreate: true });
  });
});

describe("withWriteHook", () => {
  it("avisa depois das escritas (inclusive falhas), não nas leituras, e preserva métodos opcionais ausentes", async () => {
    const base = createMemoryRepositories();
    const onWrite = vi.fn();
    const r = withWriteHook(base, onWrite);
    await r.events.list();
    await r.photos.listByEvent("e1");
    expect(onWrite).not.toHaveBeenCalled();
    await r.reactions.put({ eventId: "e1", photoId: "p1", authorId: "u1", kind: "amei" });
    expect(onWrite).toHaveBeenCalledTimes(1);
    await expect(r.photos.finalize("nada")).rejects.toThrow();
    expect(onWrite).toHaveBeenCalledTimes(2);
    expect(await base.reactions.listByEvent("e1")).toHaveLength(1);
    expect("report" in r.photos).toBe(false);
    expect("listMine" in r.events).toBe(false);
    expect(typeof r.photos.getUrls).toBe("function");
  });
});
