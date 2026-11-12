import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENT, fakeSupabase, measure } from "@/perf/fake-supabase";
import { SIGNED_URL_TTL_S, createSupabaseRepositories } from "./index";

const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const photos = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, eventId: EVENT }));

describe("photos.getUrls no servidor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("20 fotos inteiras: uma ida, caminho montado no cliente, validade de 1 h", async () => {
    const { sb, calls } = fakeSupabase();
    const m = await measure(adv, () => createSupabaseRepositories(sb).photos.getUrls!(photos, "full"));
    expect(calls.map((c) => c.what)).toEqual(["signMany(20)"]);
    expect(m.serial).toBe(1);
    expect(m.value.p3.url).toContain(`${EVENT}/p3`);
    expect(m.value.p3.size).toBe("full");
    expect(m.value.p3.expiresAt).toBe(Date.now() - 100 + SIGNED_URL_TTL_S * 1000);
  });

  it("miniaturas: assina miniatura e original juntas (uma ida) e cai na original quando não há miniatura", async () => {
    const { sb, calls } = fakeSupabase();
    const m = await measure(adv, () => createSupabaseRepositories(sb).photos.getUrls!(photos, "thumb"));
    expect(calls.map((c) => c.what)).toEqual(["signMany(40)"]);
    expect(m.value.p0.url).not.toContain(".thumb");
    expect(m.value.p0.size).toBe("full");
  });

  it("miniatura existente vence; item recusado pelo Storage fica de fora", async () => {
    const sb = {
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((path) => (path.startsWith("e/b") ? { path, error: "negado", signedUrl: null } : { path, error: null, signedUrl: `https://x/${path}` })),
            error: null,
          }),
        }),
      },
    };
    const r = createSupabaseRepositories(sb as never);
    const got = await r.photos.getUrls!([{ id: "a", eventId: "e" }, { id: "b", eventId: "e" }], "thumb");
    expect(got.a).toMatchObject({ url: "https://x/e/a.thumb", size: "thumb" });
    expect(got.b).toBeUndefined();
    expect(await r.photos.getUrls!([], "full")).toEqual({});
  });

  it("getUrl (só o id): 2 idas no máximo, mesmo para miniatura", async () => {
    const { sb, calls } = fakeSupabase();
    const m = await measure(adv, () => createSupabaseRepositories(sb).photos.getUrl("p1", "thumb"));
    expect(calls.length).toBe(2);
    expect(m.serial).toBe(2);
    expect(m.value?.url).toContain(`${EVENT}/p1`);
  });
});
