import { beforeEach, describe, expect, it } from "vitest";
import type { MemoEvent } from "@/domain/event";
import type { Photo } from "@/domain/photo";
import { createIndexedDbRepositories, createMemoryRepositories, deleteEventCascade, type Repositories } from "./index";

const ev = (id: string, code: string): MemoEvent => ({
  id, code, title: "Emy e Igor", category: "casamento", hostId: "h", hostName: "Emy", startAt: 1, durationHours: 6,
  cameraStyle: "original", revealTiming: "ao-terminar", revealDelayDays: 0, capacity: 50, shotsPerPerson: 24,
  everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt: 1,
});
const photo = (id: string, eventId: string, createdAt = 1): Photo => ({ id, eventId, authorId: "a", authorName: "Ana", createdAt, moment: "O sim", status: "visivel", reports: 0, highlighted: false });
const bytes = (...n: number[]) => new Uint8Array(n).buffer;

let n = 0;
const impls: [string, () => Repositories][] = [
  ["memória", createMemoryRepositories],
  ["IndexedDB", () => createIndexedDbRepositories(`teste-${n++}`)],
];

describe.each(impls)("contrato dos repositórios (%s)", (_name, make) => {
  let r: Repositories;
  beforeEach(() => {
    r = make();
  });

  it("salva, lista, busca por id e por código, e remove eventos", async () => {
    await r.events.save(ev("e1", "AAAAAAAA"));
    await r.events.save(ev("e2", "BBBBBBBB"));
    expect((await r.events.list()).map((e) => e.id).sort()).toEqual(["e1", "e2"]);
    expect((await r.events.getByCode("BBBBBBBB"))?.id).toBe("e2");
    expect(await r.events.getByCode("CCCCCCCC")).toBeUndefined();
    await r.events.save({ ...ev("e1", "AAAAAAAA"), title: "Novo nome" });
    expect((await r.events.get("e1"))?.title).toBe("Novo nome");
    await r.events.remove("e1");
    expect(await r.events.get("e1")).toBeUndefined();
  });

  it("guarda fotos com bytes, ordena da mais nova para a mais antiga", async () => {
    await r.photos.add(photo("p1", "e1", 1), { bytes: bytes(1, 2, 3), type: "image/jpeg" });
    await r.photos.add(photo("p2", "e1", 2), { bytes: bytes(9), type: "image/jpeg" });
    expect((await r.photos.listByEvent("e1")).map((p) => p.id)).toEqual(["p2", "p1"]);
    const d = await r.photos.getData("p1");
    expect(Array.from(new Uint8Array(d!.bytes))).toEqual([1, 2, 3]);
    expect(d!.type).toBe("image/jpeg");
    await r.photos.update({ ...photo("p1", "e1", 1), status: "oculta" });
    expect((await r.photos.get("p1"))?.status).toBe("oculta");
    await r.photos.remove("p1");
    expect(await r.photos.get("p1")).toBeUndefined();
    expect(await r.photos.getData("p1")).toBeUndefined();
  });

  it("uma reação por (foto, autor)", async () => {
    await r.reactions.put({ eventId: "e1", photoId: "p1", authorId: "u1", kind: "amei" });
    await r.reactions.put({ eventId: "e1", photoId: "p1", authorId: "u1", kind: "uau" });
    await r.reactions.put({ eventId: "e1", photoId: "p1", authorId: "u2", kind: "amei" });
    expect(await r.reactions.listByEvent("e1")).toHaveLength(2);
    await r.reactions.remove("p1", "u1");
    expect((await r.reactions.listByEvent("e1")).map((x) => x.authorId)).toEqual(["u2"]);
  });

  it("participantes, convites e usuário local", async () => {
    await r.participants.put({ eventId: "e1", userId: "u1", name: "Ana", joinedAt: 1 });
    expect((await r.participants.get("e1", "u1"))?.name).toBe("Ana");
    expect(await r.participants.listByEvent("e1")).toHaveLength(1);
    await r.invitations.put({ id: "i1", eventId: "e1", label: "Mesa 8", createdAt: 1 });
    expect((await r.invitations.listByEvent("e1"))[0].label).toBe("Mesa 8");
    expect(await r.users.current()).toBeUndefined();
    await r.users.save({ id: "u1", name: "Ana", createdAt: 1 });
    expect((await r.users.current())?.name).toBe("Ana");
    await r.users.clear();
    expect(await r.users.current()).toBeUndefined();
  });

  it("excluir evento remove tudo que depende dele e preserva os outros", async () => {
    await r.events.save(ev("e1", "AAAAAAAA"));
    await r.events.save(ev("e2", "BBBBBBBB"));
    await r.photos.add(photo("p1", "e1"), { bytes: bytes(1), type: "image/jpeg" });
    await r.photos.add(photo("p9", "e2"), { bytes: bytes(2), type: "image/jpeg" });
    await r.reactions.put({ eventId: "e1", photoId: "p1", authorId: "u1", kind: "amei" });
    await r.participants.put({ eventId: "e1", userId: "u1", name: "Ana", joinedAt: 1 });
    await r.invitations.put({ id: "i1", eventId: "e1", label: "Mesa 1", createdAt: 1 });
    await deleteEventCascade(r, { id: "e1" });
    expect(await r.events.get("e1")).toBeUndefined();
    expect(await r.photos.listByEvent("e1")).toEqual([]);
    expect(await r.photos.getData("p1")).toBeUndefined();
    expect(await r.reactions.listByEvent("e1")).toEqual([]);
    expect(await r.participants.listByEvent("e1")).toEqual([]);
    expect(await r.invitations.listByEvent("e1")).toEqual([]);
    expect((await r.photos.listByEvent("e2")).map((p) => p.id)).toEqual(["p9"]);
  });
});
