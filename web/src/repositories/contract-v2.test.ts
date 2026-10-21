import { beforeEach, describe, expect, it } from "vitest";
import type { MemoEvent } from "@/domain/event";
import type { Photo } from "@/domain/photo";
import { RepositoryError, StorageUnavailableError, createIndexedDbRepositories, createMemoryRepositories, type Repositories } from "./index";

const ev = (id: string, code: string): MemoEvent => ({
  id, code, title: "Emy e Igor", category: "casamento", hostId: "h", hostName: "Emy", startAt: 0, durationHours: 6, cameraStyle: "original",
  revealEnabled: false, revealAt: null, revealAnchor: "data", revealOffsetDays: 0, timezone: "UTC", revealStatus: "desativada", revealedAt: null,
  capacity: 50, shotsPerPerson: 24, everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt: 1, version: 1,
});
const ph = (id: string, createdAt: number, o: Partial<Photo> = {}): Photo => ({ id, eventId: "e1", authorId: "a", authorName: "Ana", createdAt, moment: "O sim", status: "visivel", reports: 0, highlighted: false, version: 1, ...o });
const data = (n: number) => ({ bytes: new Uint8Array([n]).buffer, type: "image/jpeg" });

let n = 0;
const impls: [string, () => Repositories][] = [["memória", createMemoryRepositories], ["IndexedDB", () => createIndexedDbRepositories(`v2-${n++}`)]];

describe.each(impls)("contrato v2 (%s)", (_name, make) => {
  let r: Repositories;
  beforeEach(() => { r = make(); });

  it("erros tipados: RepositoryError com código; StorageUnavailableError é um deles", () => {
    const e = new RepositoryError("conflict", "versão antiga");
    expect(e.code).toBe("conflict");
    expect(e).toBeInstanceOf(Error);
    expect(new StorageUnavailableError()).toBeInstanceOf(RepositoryError);
    expect(new StorageUnavailableError().code).toBe("unavailable");
  });

  it("evento: save devolve a versão gravada; versão antiga é conflito tipado (lost update)", async () => {
    const first = await r.events.save(ev("e1", "AAAAAAAA"));
    expect(first.version).toBe(1);
    const second = await r.events.save({ ...first, title: "B" }, { expectedVersion: 1 });
    expect(second.version).toBe(2);
    await expect(r.events.save({ ...first, title: "C" }, { expectedVersion: 1 })).rejects.toMatchObject({ name: "RepositoryError", code: "conflict" });
    expect((await r.events.get("e1"))!.title).toBe("B");
  });

  it("foto: update versionado, conflito tipado e not-found em foto inexistente", async () => {
    await r.photos.add(ph("p1", 1), data(1));
    const got = (await r.photos.get("p1"))!;
    const upd = await r.photos.update({ ...got, status: "oculta" }, { expectedVersion: got.version });
    expect(upd.version).toBe(got.version + 1);
    await expect(r.photos.update({ ...got, status: "removida" }, { expectedVersion: got.version })).rejects.toMatchObject({ code: "conflict" });
    await expect(r.photos.update(ph("fantasma", 1))).rejects.toMatchObject({ code: "not-found" });
  });

  it("contagem sem baixar a lista: fotos por autor/status e participantes", async () => {
    await r.photos.add(ph("p1", 1), data(1));
    await r.photos.add(ph("p2", 2, { authorId: "b" }), data(2));
    await r.photos.add(ph("p3", 3, { status: "removida" }), data(3));
    expect(await r.photos.count("e1")).toBe(3);
    expect(await r.photos.count("e1", { excludeStatus: "removida" })).toBe(2);
    expect(await r.photos.count("e1", { authorId: "a", excludeStatus: "removida" })).toBe(1);
    await r.participants.put({ eventId: "e1", userId: "u1", name: "A", joinedAt: 1 });
    await r.participants.put({ eventId: "e1", userId: "u2", name: "B", joinedAt: 2 });
    expect(await r.participants.count("e1")).toBe(2);
  });

  it("paginação por cursor opaco: mais novas primeiro, sem repetir nem pular, com total", async () => {
    for (let i = 1; i <= 7; i++) await r.photos.add(ph(`p${i}`, i), data(i));
    const seen: string[] = [];
    let cursor: string | null = null, pages = 0;
    do {
      const page = await r.photos.page("e1", { limit: 3, cursor });
      expect(page.total).toBe(7);
      seen.push(...page.items.map((p) => p.id));
      cursor = page.nextCursor; pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen).toEqual(["p7", "p6", "p5", "p4", "p3", "p2", "p1"]);
  });

  it("add é idempotente por id: reenvio não duplica nem sobrescreve os bytes", async () => {
    await r.photos.add(ph("p1", 1, { caption: "primeira" }), data(1));
    await r.photos.add(ph("p1", 2, { caption: "reenvio" }), data(9));
    expect(await r.photos.count("e1")).toBe(1);
    expect((await r.photos.get("p1"))!.caption).toBe("primeira");
    expect(Array.from(new Uint8Array((await r.photos.getData("p1"))!.bytes))).toEqual([1]);
  });
});

describe("ITG-102: migração v5 (version)", () => {
  it("registros antigos ganham version 1; o controle mostra que antes não existia", async () => {
    const { MIGRATIONS } = await import("./indexeddb");
    const name = `v5-${n++}`;
    const v4 = createIndexedDbRepositories(name, MIGRATIONS.slice(0, 4));
    await v4.events.save({ ...ev("e1", "AAAAAAAA"), version: undefined } as never);
    await v4.photos.add({ ...ph("p1", 1), version: undefined } as never, data(1));
    // sem o save versionado do v5 a gravação já atribuiu version; força o estado legado direto no armazenamento
    const raw = await new Promise<IDBDatabase>((res) => { const q = indexedDB.open(name); q.onsuccess = () => res(q.result); });
    await new Promise<void>((res) => {
      const tx = raw.transaction(["events", "photos"], "readwrite");
      const e = ev("e1", "AAAAAAAA") as Partial<MemoEvent>, p = ph("p1", 1) as Partial<Photo>;
      delete e.version; delete p.version;
      tx.objectStore("events").put(e); tx.objectStore("photos").put(p);
      tx.oncomplete = () => res();
    });
    raw.close();
    const v5 = createIndexedDbRepositories(name);
    expect((await v5.events.get("e1"))!.version).toBe(1);
    expect((await v5.photos.get("p1"))!.version).toBe(1);
  });
});
