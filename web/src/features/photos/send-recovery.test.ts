import { describe, expect, it } from "vitest";
import { createMemoryRepositories, RepositoryError, type Repositories, type User } from "@/repositories";
import { createEvent, type EventInput } from "../events/service";
import { postPhoto, usedShots } from "./service";
const now = 1_800_000_000_000;
const user = { id: "photo-user", name: "Ana", createdAt: 1 } satisfies User;
const data = { bytes: new Uint8Array([1, 2, 3]).buffer, type: "image/jpeg" };
const input = { title: "Festa", category: "festa", durationHours: 3, reveal: { enabled: false }, cameraStyle: "original", capacity: 10, shotsPerPerson: 5, everyoneSeesAll: false, palette: "salvia", eventFont: "birthstone" } as EventInput;
describe("recuperação de todas as etapas do envio", () => {
  it.each(["counts", "begin", "attach", "finalize"] as const)("%s indisponível vira rede e permite repetir a mesma identidade", async (stage) => {
    const base = createMemoryRepositories();
    const created = await createEvent(base, user, input, now);
    if (!created.ok) throw new Error("fixture");
    let fail = true;
    const r: Repositories = { ...base, events: { ...base.events, counts: async (...args) => { if (stage === "counts" && fail) throw new RepositoryError("unavailable", "offline"); return base.events.counts(...args); } }, photos: { ...base.photos } };
    if (stage !== "counts") {
      const original = base.photos[stage];
      r.photos[stage] = (async (...args: never[]) => { if (fail) throw new RepositoryError("unavailable", "offline"); return (original as (...args: never[]) => unknown)(...args); }) as never;
    }
    const photoId = crypto.randomUUID();
    await expect(postPhoto(r, created.event, user, data, { moment: "Agora" }, now, { photoId })).resolves.toEqual({ ok: false, reason: "rede" });
    fail = false;
    const done = await postPhoto(r, created.event, user, data, { moment: "Agora" }, now, { photoId, resume: true });
    expect(done.ok && done.photo.id).toBe(photoId);
    expect(await usedShots(base, created.event.id, user.id)).toBe(1);
  });
});

describe("recusas do envio", () => {
  it.each(["counts", "begin", "attach", "finalize"] as const)("%s bloqueado não vira rede nem continua upload", async (stage) => {
    const base = createMemoryRepositories();
    const created = await createEvent(base, user, input, now);
    if (!created.ok) throw new Error("fixture");
    const denial = new RepositoryError("forbidden", "blocked");
    Object.defineProperty(denial, "code", { value: "blocked" });
    const r = { ...base, events: { ...base.events }, photos: { ...base.photos } };
    let attached = 0;
    r.photos.attach = async (...args) => { attached += 1; return base.photos.attach(...args); };
    if (stage === "counts") r.events.counts = async () => { throw denial; };
    else r.photos[stage] = (async () => { throw denial; }) as never;
    expect(await postPhoto(r, created.event, user, data, { moment: "Agora" }, now)).toEqual({ ok: false, reason: "bloqueado" });
    expect(attached).toBe(stage === "finalize" ? 1 : 0);
  });
  it.each([["forbidden", "acesso"], ["not-found", "nao-encontrado"]] as const)("distingue %s de falha de rede", async (code, reason) => {
    const base = createMemoryRepositories();
    const created = await createEvent(base, user, input, now);
    if (!created.ok) throw new Error("fixture");
    base.events.counts = async () => { throw new RepositoryError(code, "denied"); };
    expect(await postPhoto(base, created.event, user, data, { moment: "Agora" }, now)).toEqual({ ok: false, reason });
  });
});
