import { describe, expect, it, vi } from "vitest";
import { claim, claimPhotos, complete, completePhotos, fail, PULL_ENGINE_VERSION, safeEqual, sha256Hex, tokenOk, type PullDeps } from "./smart-album-pull.ts";

const J = "00000000-0000-4000-8000-0000000000aa";
const P1 = "00000000-0000-4000-8000-0000000000f1";
const P2 = "00000000-0000-4000-8000-0000000000f2";

function deps(over: Partial<PullDeps> = {}, claimed: unknown[] = [{ jobId: J, eventId: "e1", profileId: "p", referencePath: "e1/u/p", photoIds: [P1, P2] }]) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const d: PullDeps = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "smart_album_worker_claim") return { data: claimed, error: null };
      if (fn === "smart_album_worker_complete") return { data: (args.p_matches as unknown[]).length, error: null };
      return { data: "failed", error: null };
    }),
    sign: vi.fn(async (bucket: string, paths: string[]) => Object.fromEntries(paths.filter((p) => !p.endsWith(P2)).map((p) => [p, `https://abc.supabase.co/s/${bucket}/${p}`]))),
    ...over,
  };
  return { d, calls };
}

describe("modo pull", () => {
  it("token comparado em tempo constante e nunca vazio", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
  });
  it("token: compara o SHA-256; curto ou errado é recusado", async () => {
    const t = "x".repeat(40);
    const h = await sha256Hex(t);
    expect(await tokenOk(t, h)).toBe(true);
    expect(await tokenOk("y".repeat(40), h)).toBe(false);
    expect(await tokenOk("curto", await sha256Hex("curto"))).toBe(false);
  });
  it("claim: 1 job com URLs assinadas; foto sem URL fica de fora", async () => {
    const { d } = deps();
    expect(await claim(d)).toEqual({ jobId: J, referenceUrl: "https://abc.supabase.co/s/face-references/e1/u/p", photos: [{ id: P1, url: `https://abc.supabase.co/s/event-photos/e1/${P1}` }] });
    expect(d.rpc).toHaveBeenCalledWith("smart_album_worker_claim", { p_limit: 1 });
  });
  it("claim: fila vazia = null", async () => {
    expect(await claim(deps({}, []).d)).toBeNull();
  });
  it("claim: referência sumida falha o job como referência inválida", async () => {
    const { d, calls } = deps({ sign: vi.fn(async () => ({})) });
    expect(await claim(d)).toBeNull();
    expect(calls.at(-1)).toEqual({ fn: "smart_album_worker_fail", args: { p_job: J, p_error: "reference_missing", p_reference_invalid: true } });
  });
  it("complete: só {photoId uuid, band válida}; versão do motor fixada no servidor", async () => {
    const { d, calls } = deps();
    expect(await complete(d, { jobId: J, processed: 2, engine: "falso", matches: [{ photoId: P1, band: "probable", score: 0.9 }, { photoId: "x", band: "probable" }, { photoId: P2, band: "certo" }] })).toBe(1);
    expect(calls.at(-1)).toEqual({ fn: "smart_album_worker_complete", args: { p_job: J, p_matches: [{ photoId: P1, band: "probable" }], p_processed: 2, p_engine: PULL_ENGINE_VERSION } });
    await expect(complete(d, { jobId: "nao-uuid", matches: [] })).rejects.toThrow("invalid");
  });
  it("fail: código de erro só [a-z_]", async () => {
    const { d, calls } = deps();
    expect(await fail(d, { jobId: J, error: "no_face", referenceInvalid: true })).toBe("failed");
    expect(calls.at(-1)?.args).toEqual({ p_job: J, p_error: "no_face", p_reference_invalid: true });
    await expect(fail(d, { jobId: J, error: "Texto Livre com PII" })).rejects.toThrow("invalid");
  });
  it("claimPhotos: lote com URLs de fotos e selfies; fila vazia = null; foto/selfie sem URL fica de fora", async () => {
    const E = "00000000-0000-4000-8000-0000000000e1", R1 = "00000000-0000-4000-8000-0000000000c1";
    const rpc = vi.fn(async () => ({ data: { photos: [{ photoId: P1, eventId: E }, { photoId: P2, eventId: E }], refs: [{ eventId: E, profileId: R1, referencePath: "conta/u/p" }] }, error: null }));
    const { d } = deps({ rpc });
    expect(await claimPhotos(d)).toEqual({
      photos: [{ id: P1, eventId: E, url: `https://abc.supabase.co/s/event-photos/${E}/${P1}` }],
      refs: [{ eventId: E, profileId: R1, url: "https://abc.supabase.co/s/face-references/conta/u/p" }],
    });
    expect(rpc).toHaveBeenCalledWith("smart_album_worker_claim_photos", { p_limit: 8 });
    expect(await claimPhotos(deps({ rpc: vi.fn(async () => ({ data: { photos: [], refs: [] }, error: null })) }).d)).toBeNull();
  });
  it("completePhotos: saneia ids, faixas, números e erros de selfie; versão do motor fixada no servidor", async () => {
    const R1 = "00000000-0000-4000-8000-0000000000c1";
    const rpc = vi.fn(async () => ({ data: 1, error: null }));
    const { d } = deps({ rpc });
    expect(await completePhotos(d, {
      results: [{ photoId: P1, faces: 3.7, sharpness: -5, score: 0.9, matches: [{ profileId: R1, band: "probable", score: 0.8 }, { profileId: "x", band: "probable" }, { profileId: R1, band: "certo" }] }, { photoId: "nao-uuid", faces: 1 }],
      failed: [P2, "lixo"], refErrors: [{ profileId: R1, error: "no_face" }, { profileId: R1, error: "DROP TABLE" }], engine: "falso",
    })).toBe(1);
    expect(rpc).toHaveBeenCalledWith("smart_album_worker_complete_photos", {
      p_results: [{ photoId: P1, faces: 3, sharpness: 0, matches: [{ profileId: R1, band: "probable" }] }],
      p_failed: [P2], p_ref_errors: [{ profileId: R1, error: "no_face" }], p_engine: PULL_ENGINE_VERSION,
    });
    await expect(completePhotos(d, { results: "x" })).rejects.toThrow("invalid");
  });
});
