import { describe, expect, it, vi } from "vitest";
import { DisabledFaceEngine, FaceEngineDisabledError, FakeFaceEngine } from "./face-engine.ts";
import { checkReferenceBytes, processJob, runBatch, type ClaimedJob, type WorkerDeps } from "./smart-album-worker.ts";

/** PNG sintético válido (assinatura + IHDR com as dimensões pedidas) seguido de um marcador de teste. Não contém rosto algum. */
function png(w: number, h: number, marker = ""): Uint8Array {
  const head = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const body = [...head, ...be(w), ...be(h), 8, 6, 0, 0, 0, 0, 0, 0, 0];
  return new Uint8Array([...body, ...new TextEncoder().encode(marker)]);
}

const job: ClaimedJob = { jobId: "j1", eventId: "e1", profileId: "p1", referencePath: "e1/u1/p1", photoIds: ["f1", "f2", "f3", "f4"] };

function deps(over: Partial<WorkerDeps> & { files?: Record<string, Uint8Array | null> } = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const files: Record<string, Uint8Array | null> = over.files ?? {
    "face-references/e1/u1/p1": png(400, 400, "FAKEFACE:ana;"),
    "event-photos/e1/f1": png(1200, 800, "FAKEFACE:ana;FAKEFACE:bia;"),
    "event-photos/e1/f2": png(1200, 800, "FAKEFACE:bia;"),
    "event-photos/e1/f3": png(1200, 800, "FAKEFACE:ana~;"),
    "event-photos/e1/f4": null,
  };
  const d: WorkerDeps = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "smart_album_worker_complete") return { data: (args.p_matches as unknown[]).length, error: null };
      if (fn === "smart_album_worker_fail") return { data: "failed", error: null };
      if (fn === "smart_album_worker_claim") return { data: [job], error: null };
      return { data: null, error: null };
    }),
    download: vi.fn(async (bucket: string, path: string) => {
      const f = files[`${bucket}/${path}`];
      return f === undefined || f === null ? null : f.slice();
    }),
    engine: new FakeFaceEngine({ allow: true }),
    log: vi.fn(),
    ...over,
  };
  return { d, calls };
}

describe("FaceEngine", () => {
  it("o motor padrão é desligado e recusa qualquer análise", async () => {
    const e = new DisabledFaceEngine();
    expect(e.version).toBe("disabled");
    await expect(e.analyzeReference()).rejects.toBeInstanceOf(FaceEngineDisabledError);
    await expect(e.compare()).rejects.toBeInstanceOf(FaceEngineDisabledError);
  });
  it("o motor de teste não nasce fora de teste", () => {
    expect(() => new FakeFaceEngine({ allow: false })).toThrow(FaceEngineDisabledError);
  });
  it("motor de teste: sem marcador = sem rosto; dois = vários rostos", async () => {
    const e = new FakeFaceEngine({ allow: true });
    expect(await e.analyzeReference(png(400, 400))).toEqual({ ok: false, error: "no_face" });
    expect(await e.analyzeReference(png(400, 400, "FAKEFACE:a;FAKEFACE:b;"))).toEqual({ ok: false, error: "multiple_faces" });
  });
});

describe("checkReferenceBytes", () => {
  it("valida pelo conteúdo: não-imagem, pequena demais, gigante", () => {
    expect(checkReferenceBytes(new TextEncoder().encode("<svg onload=alert(1)>"))).toBe("invalid_image");
    expect(checkReferenceBytes(new Uint8Array())).toBe("invalid_image");
    expect(checkReferenceBytes(png(100, 100))).toBe("low_quality");
    expect(checkReferenceBytes(png(9000, 100))).toBe("invalid_image");
    expect(checkReferenceBytes(png(400, 400))).toBeNull();
  });
});

describe("processJob", () => {
  it("devolve só {photoId, band} das fotos com candidato e descarta o handle", async () => {
    const { d, calls } = deps();
    const out = await processJob(d, job);
    expect(out).toEqual({ jobId: "j1", status: "completed", matches: 2, processed: 4 });
    const complete = calls.find((c) => c.fn === "smart_album_worker_complete")!;
    expect(complete.args).toEqual({ p_job: "j1", p_matches: [{ photoId: "f1", band: "probable" }, { photoId: "f3", band: "review" }], p_processed: 4, p_engine: "fake-engine-0" });
    expect((d.engine as FakeFaceEngine).liveHandles).toBe(0);
  });
  it("referência sem rosto: falha definitiva marcada como referência inválida (a pessoa troca a foto)", async () => {
    const { d, calls } = deps({ files: { "face-references/e1/u1/p1": png(400, 400) } });
    const out = await processJob(d, job);
    expect(out.status).toBe("failed");
    expect(calls.at(-1)).toEqual({ fn: "smart_album_worker_fail", args: { p_job: "j1", p_error: "no_face", p_reference_invalid: true } });
    expect(calls.some((c) => c.fn === "smart_album_worker_complete")).toBe(false);
  });
  it("referência que não é imagem nem chega ao motor", async () => {
    const analyze = vi.fn();
    const { d, calls } = deps({ files: { "face-references/e1/u1/p1": new TextEncoder().encode("GIF89a…") }, engine: { version: "x", analyzeReference: analyze, compare: vi.fn(), dispose: vi.fn() } });
    await processJob(d, job);
    expect(analyze).not.toHaveBeenCalled();
    expect(calls.at(-1)?.args.p_error).toBe("invalid_image");
  });
  it("motor indisponível: falha transitória (sem marcar a referência)", async () => {
    const { d, calls } = deps({ engine: new DisabledFaceEngine() });
    await processJob(d, job);
    expect(calls.at(-1)).toEqual({ fn: "smart_album_worker_fail", args: { p_job: "j1", p_error: "engine_unavailable", p_reference_invalid: false } });
  });
  it("erro no meio da comparação: falha, e o handle é descartado mesmo assim", async () => {
    const e = new FakeFaceEngine({ allow: true });
    const compare = vi.spyOn(e, "compare").mockRejectedValueOnce(new Error("boom"));
    const { d, calls } = deps({ engine: e });
    await processJob(d, job);
    expect(compare).toHaveBeenCalled();
    expect(e.liveHandles).toBe(0);
    expect(calls.at(-1)?.args.p_error).toBe("engine_error");
  });
  it("respeita o teto de fotos e o prazo", async () => {
    const { d } = deps({ maxPhotos: 2 });
    expect((await processJob(d, job)).processed).toBe(2);
    let t = 0;
    const { d: d2 } = deps({ deadlineMs: 5, now: () => (t += 3) });
    expect((await processJob(d2, job)).processed).toBeLessThan(4);
  });
  it("o log não leva bytes, caminho nem rótulo", async () => {
    const { d } = deps();
    await processJob(d, job);
    const lines = (d.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0])).join("\n");
    expect(lines).not.toMatch(/e1\/u1|FAKEFACE|ana|PNG/);
    expect(lines).toContain("job=j1");
  });
});

describe("runBatch", () => {
  it("pede os jobs ao banco e processa em sequência", async () => {
    const { d, calls } = deps();
    const out = await runBatch(d, 2);
    expect(calls[0]).toEqual({ fn: "smart_album_worker_claim", args: { p_limit: 2 } });
    expect(out).toHaveLength(1);
  });
  it("um job que o banco recusa (revogado no meio) não derruba o resto do lote", async () => {
    const jobs = [job, { ...job, jobId: "j2" }];
    const { d } = deps();
    d.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "smart_album_worker_claim") return { data: jobs, error: null };
      if (fn === "smart_album_worker_complete" && args.p_job === "j1") return { data: null, error: { code: "MM005" } };
      if (fn === "smart_album_worker_complete") return { data: 1, error: null };
      return { data: null, error: null };
    }) as WorkerDeps["rpc"];
    const out = await runBatch(d, 2);
    expect(out.map((o) => [o.jobId, o.status])).toEqual([["j1", "cancelled"], ["j2", "completed"]]);
  });
});
