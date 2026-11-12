import { describe, expect, it } from "vitest";
import { createMemoryRepositories, RepositoryError, type PhotoData, type Repositories, type User } from "@/repositories";
import { createSupabaseRepositories } from "@/repositories/supabase";
import { createEvent, type EventInput } from "../events/service";
import { postPhoto } from "./service";
import { makeThumb } from "./thumb";

const now = 1_800_000_000_000;
const user = { id: "thumb-user", name: "Ana", createdAt: 1 } satisfies User;
const data = { bytes: new Uint8Array([1, 2, 3]).buffer, type: "image/jpeg" };
const small = { bytes: new Uint8Array([9]).buffer, type: "image/jpeg" };
const input = { title: "Festa", category: "festa", durationHours: 3, reveal: { enabled: false }, cameraStyle: "original", capacity: 10, shotsPerPerson: 5, everyoneSeesAll: false, palette: "salvia", eventFont: "birthstone" } as EventInput;

async function setup() {
  const base = createMemoryRepositories();
  const created = await createEvent(base, user, input, now);
  if (!created.ok) throw new Error("fixture");
  const order: string[] = [];
  const repos: Repositories = { ...base, photos: { ...base.photos } };
  repos.photos.attach = async (id, d) => { order.push("attach"); return base.photos.attach(id, d); };
  repos.photos.finalize = async (id) => { order.push("finalize"); return base.photos.finalize(id); };
  return { repos, event: created.event, order };
}

describe("miniatura .thumb no envio", () => {
  it("gera a miniatura e a grava entre a original e a publicação", async () => {
    const { repos, event, order } = await setup();
    const got: PhotoData[] = [];
    repos.photos.attachThumb = async (_id, t) => { order.push("thumb"); got.push(t); };
    const r = await postPhoto(repos, event, user, data, { moment: "Agora" }, now, { thumb: async () => small });
    expect(r.ok).toBe(true);
    expect(order).toEqual(["attach", "thumb", "finalize"]);
    expect(got[0].bytes.byteLength).toBe(1);
  });

  it("falha ao gerar ou ao enviar a miniatura não impede a publicação", async () => {
    for (const fail of ["gerar", "enviar"] as const) {
      const { repos, event, order } = await setup();
      repos.photos.attachThumb = async () => { if (fail === "enviar") throw new RepositoryError("unavailable", "offline"); order.push("thumb"); };
      const thumb = fail === "gerar" ? async () => { throw new Error("sem canvas"); } : async () => small;
      const r = await postPhoto(repos, event, user, data, { moment: "Agora" }, now, { thumb });
      expect(r.ok, fail).toBe(true);
      expect(order, fail).toEqual(["attach", "finalize"]);
    }
  });

  it("repositório local (sem attachThumb) não gera miniatura", async () => {
    const { repos, event } = await setup();
    let made = 0;
    const r = await postPhoto(repos, event, user, data, { moment: "Agora" }, now, { thumb: async () => { made += 1; return small; } });
    expect(r.ok).toBe(true);
    expect(made).toBe(0);
  });

  it("sem suporte no navegador (jsdom), makeThumb devolve undefined", async () => {
    expect(await makeThumb(data)).toBeUndefined();
  });

  it("servidor grava em `${evento}/${foto}.thumb`, sem sobrescrever, e ignora reenvio já existente", async () => {
    const uploads: { path: string; upsert: boolean }[] = [];
    let duplicate = false;
    const sb = {
      rpc: async () => ({ data: { uploadStatus: "enviando" }, error: null }),
      storage: { from: () => ({ upload: async (path: string, _b: Blob, o: { upsert: boolean }) => { uploads.push({ path, upsert: o.upsert }); return { data: {}, error: duplicate ? { message: "The resource already exists" } : null }; } }) },
    };
    const repos = createSupabaseRepositories(sb as never);
    const photo = { id: "p1", eventId: "e1", authorId: "u", authorName: "A", createdAt: now, moment: "Agora", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "enviando" } as const;
    await repos.photos.begin(photo);
    await repos.photos.attachThumb!("p1", small);
    duplicate = true;
    await expect(repos.photos.attachThumb!("p1", small)).resolves.toBeUndefined();
    expect(uploads).toEqual([{ path: "e1/p1.thumb", upsert: false }, { path: "e1/p1.thumb", upsert: false }]);
  });
});
