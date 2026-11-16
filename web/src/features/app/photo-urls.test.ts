import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoRepository, PhotoSize, PhotoUrl } from "@/repositories";
import { createMemoryRepositories } from "@/repositories";
import { createSupabaseRepositories } from "@/repositories/supabase";
import { EVENT, fakeSupabase, measure } from "@/perf/fake-supabase";
import { RENEW_BEFORE_MS, loadPhotoUrls, nextRenewal, peekPhotoUrls } from "./photo-urls";

const ps = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, eventId: EVENT }));

/** Repositório de fotos que assina em lote e conta os lotes. */
function signer(ttlMs = 3_600_000) {
  let n = 0;
  const batches: string[][] = [];
  const getUrls = vi.fn(async (photos: { id: string }[], size: PhotoSize) => {
    batches.push(photos.map((p) => p.id));
    n++;
    return Object.fromEntries(photos.map((p) => [p.id, { url: `https://x/${p.id}?v=${n}`, release: () => undefined, expiresAt: Date.now() + ttlMs, size: size === "thumb" ? "full" : size } as PhotoUrl]));
  });
  return { repo: { getUrls, getUrl: vi.fn() } as unknown as PhotoRepository, batches, getUrls };
}

describe("cache de URLs de foto", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("assina num lote só e devolve a MESMA URL depois (entre telas), sem nova ida", async () => {
    const { repo, getUrls } = signer();
    const a = await loadPhotoUrls(repo, ps(20), "full");
    const b = await loadPhotoUrls(repo, ps(20), "full");
    expect(getUrls).toHaveBeenCalledTimes(1);
    expect(b.urls).toEqual(a.urls);
    expect(peekPhotoUrls(repo, ps(2), "full")).toEqual({ p0: a.urls.p0, p1: a.urls.p1 });
  });

  it("pedidos simultâneos da mesma foto se juntam; só as que faltam vão no próximo lote", async () => {
    const { repo, batches } = signer();
    await Promise.all([loadPhotoUrls(repo, ps(3), "full"), loadPhotoUrls(repo, ps(3), "full")]);
    await loadPhotoUrls(repo, ps(5), "full");
    expect(batches).toEqual([["p0", "p1", "p2"], ["p3", "p4"]]);
  });

  it("renova antes de vencer", async () => {
    const { repo, getUrls } = signer(RENEW_BEFORE_MS + 60_000);
    const a = await loadPhotoUrls(repo, ps(1), "full");
    expect(nextRenewal(repo, ps(1), "full")).toBe(Date.now() + 60_000);
    vi.advanceTimersByTime(30_000);
    expect((await loadPhotoUrls(repo, ps(1), "full")).urls.p0).toBe(a.urls.p0);
    vi.advanceTimersByTime(31_000);
    const c = await loadPhotoUrls(repo, ps(1), "full");
    expect(getUrls).toHaveBeenCalledTimes(2);
    expect(c.urls.p0).not.toBe(a.urls.p0);
  });

  it("miniatura que caiu na original também serve para a foto aberta (full), sem nova assinatura", async () => {
    const { repo, getUrls } = signer();
    const t = await loadPhotoUrls(repo, ps(2), "thumb");
    const f = await loadPhotoUrls(repo, ps(2), "full");
    expect(getUrls).toHaveBeenCalledTimes(1);
    expect(f.urls).toEqual(t.urls);
  });

  it("falha de rede não quebra: volta vazio e tenta de novo na próxima", async () => {
    const getUrls = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ p0: { url: "u", release: () => undefined, expiresAt: Date.now() + 3_600_000 } });
    const repo = { getUrls } as unknown as PhotoRepository;
    expect((await loadPhotoUrls(repo, ps(1), "full")).urls).toEqual({});
    expect((await loadPhotoUrls(repo, ps(1), "full")).urls).toEqual({ p0: "u" });
  });

  it("local: object URLs não ficam no cache do módulo; voltam como `owned` para quem pediu liberar", async () => {
    const r = createMemoryRepositories();
    await r.photos.add({ id: "p0", eventId: EVENT, authorId: "a", authorName: "Ana", createdAt: 1, moment: "x", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta" }, { bytes: new ArrayBuffer(1), type: "image/jpeg" });
    const got = await loadPhotoUrls(r.photos, ps(1), "full");
    expect(got.urls.p0).toMatch(/^blob:/);
    expect(Object.keys(got.owned)).toEqual(["p0"]);
    expect(peekPhotoUrls(r.photos, ps(1), "full")).toEqual({});
    // quem já tem a URL não pede de novo
    const spy = vi.spyOn(r.photos, "getUrls");
    await loadPhotoUrls(r.photos, ps(1), "full", new Set(["p0"]));
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("sem getUrls (adaptador antigo), cai para getUrl em paralelo", async () => {
    const getUrl = vi.fn(async (id: string) => ({ url: id, release: () => undefined, expiresAt: Date.now() + 3_600_000 }));
    const got = await loadPhotoUrls({ getUrl } as unknown as PhotoRepository, ps(3), "thumb");
    expect(getUrl).toHaveBeenCalledTimes(3);
    expect(got.urls).toEqual({ p0: "p0", p1: "p1", p2: "p2" });
  });

  it("no servidor: 20 fotos = 1 ida (antes: 2 por foto, em série) e reabrir a tela = 0 idas", async () => {
    const { sb, calls } = fakeSupabase();
    const r = createSupabaseRepositories(sb);
    const m = await measure((ms) => vi.advanceTimersByTimeAsync(ms), () => loadPhotoUrls(r.photos, ps(20), "full"));
    expect(Object.keys(m.value.urls)).toHaveLength(20);
    expect(m.serial).toBe(1);
    expect(calls.length).toBe(1);
    await loadPhotoUrls(r.photos, ps(20), "full");
    expect(calls.length).toBe(1);
  });
});
