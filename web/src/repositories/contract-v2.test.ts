import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoEvent } from "@/domain/event";
import type { Photo } from "@/domain/photo";
import { RepositoryError, StorageUnavailableError, createIndexedDbRepositories, createMemoryRepositories, type Repositories } from "./index";

const ev = (id: string, code: string): MemoEvent => ({
  id, code, title: "Emy e Igor", category: "casamento", hostId: "h", hostName: "Emy", startAt: 0, durationHours: 6, cameraStyle: "original",
  revealEnabled: false, revealAt: null, revealAnchor: "data", revealOffsetDays: 0, timezone: "UTC", revealStatus: "desativada", revealedAt: null,
  capacity: 50, shotsPerPerson: 24, everyoneSeesAll: true, reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt: 1, version: 1,
});
const ph = (id: string, createdAt: number, o: Partial<Photo> = {}): Photo => ({ id, eventId: "e1", authorId: "a", authorName: "Ana", createdAt, moment: "O sim", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta", ...o });
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

describe.each(impls)("contrato v2: fotos por URL e envio em duas fases (%s)", (_name, make) => {
  let r: Repositories;
  beforeEach(() => {
    r = make();
    if (typeof URL.createObjectURL !== "function") {
      vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => `blob:fake-${Math.random()}`, revokeObjectURL: () => undefined }));
    }
  });

  it("begin cria a linha 'enviando': invisível nas listas, mas reserva o rolo na contagem", async () => {
    await r.photos.begin(ph("p1", 1, { uploadStatus: "enviando" }));
    expect((await r.photos.get("p1"))!.uploadStatus).toBe("enviando");
    expect(await r.photos.listByEvent("e1")).toEqual([]);
    expect((await r.photos.page("e1", { limit: 10 })).items).toEqual([]);
    expect(await r.photos.count("e1", { excludeStatus: "removida" })).toBe(1);
    expect((await r.photos.pending("e1")).map((p) => p.id)).toEqual(["p1"]);
  });
  it("attach guarda os bytes e finalize publica; finalize sem bytes é recusado", async () => {
    await r.photos.begin(ph("p1", 1, { uploadStatus: "enviando" }));
    await expect(r.photos.finalize("p1")).rejects.toMatchObject({ code: "invalid" });
    await r.photos.attach("p1", data(7));
    const done = await r.photos.finalize("p1");
    expect(done.uploadStatus).toBe("pronta");
    expect((await r.photos.listByEvent("e1")).map((p) => p.id)).toEqual(["p1"]);
    expect(await r.photos.pending("e1")).toEqual([]);
    await expect(r.photos.attach("fantasma", data(1))).rejects.toMatchObject({ code: "not-found" });
  });
  it("add continua sendo as três etapas juntas (foto pronta) e idempotente", async () => {
    await r.photos.add(ph("p1", 1), data(1));
    expect((await r.photos.get("p1"))!.uploadStatus).toBe("pronta");
  });
  it("begin é idempotente: reenvio não zera uma foto já pronta", async () => {
    await r.photos.add(ph("p1", 1), data(1));
    await r.photos.begin(ph("p1", 2, { uploadStatus: "enviando" }));
    expect((await r.photos.get("p1"))!.uploadStatus).toBe("pronta");
  });
  it("getUrl entrega URL (miniatura cai para a imagem inteira) e permite liberar; foto sem bytes não tem URL", async () => {
    await r.photos.add(ph("p1", 1), data(1));
    const full = await r.photos.getUrl("p1", "full");
    const thumb = await r.photos.getUrl("p1", "thumb");
    expect(full!.url).toMatch(/^blob:/);
    expect(thumb!.url).toMatch(/^blob:/);
    full!.release(); thumb!.release();
    expect(await r.photos.getUrl("fantasma", "full")).toBeUndefined();
    await r.photos.begin(ph("p2", 2, { uploadStatus: "enviando" }));
    expect(await r.photos.getUrl("p2", "full")).toBeUndefined();
  });
  it("getUrls entrega várias URLs de uma vez e deixa de fora quem não tem bytes", async () => {
    await r.photos.add(ph("p1", 1), data(1));
    await r.photos.add(ph("p3", 3), data(3));
    await r.photos.begin(ph("p2", 2, { uploadStatus: "enviando" }));
    const got = await r.photos.getUrls!([{ id: "p1", eventId: "e1" }, { id: "p2", eventId: "e1" }, { id: "p3", eventId: "e1" }], "thumb");
    expect(Object.keys(got).sort()).toEqual(["p1", "p3"]);
    expect(got.p1.url).toMatch(/^blob:/);
    expect(got.p1.expiresAt).toBeUndefined();
  });
});

describe("contrato v2: created_at é do repositório quando ele tem relógio (servidor)", () => {
  it.each([["memória", (now: () => number) => createMemoryRepositories({ now })], ["IndexedDB", (now: () => number) => createIndexedDbRepositories(`ts-${n++}`, undefined, { now })]] as const)(
    "%s: o horário do cliente vira capturedAt e createdAt passa a ser o do relógio do repositório",
    async (_n, make) => {
      const r = make(() => 5_000);
      await r.photos.add(ph("p1", 1_234), data(1));
      expect(await r.photos.get("p1")).toMatchObject({ createdAt: 5_000, capturedAt: 1_234 });
    },
  );
  it("sem relógio injetado (modo local) o createdAt do cliente é mantido", async () => {
    const r = createMemoryRepositories();
    await r.photos.add(ph("p1", 1_234), data(1));
    expect(await r.photos.get("p1")).toMatchObject({ createdAt: 1_234 });
  });
});

describe("ITG-103: migração v6 (uploadStatus)", () => {
  it("fotos antigas viram 'pronta'", async () => {
    const { MIGRATIONS } = await import("./indexeddb");
    const name = `v6-${n++}`;
    const v5 = createIndexedDbRepositories(name, MIGRATIONS.slice(0, 5));
    await v5.photos.add(ph("p1", 1), data(1));
    const raw = await new Promise<IDBDatabase>((res) => { const q = indexedDB.open(name); q.onsuccess = () => res(q.result); });
    await new Promise<void>((res) => { // estado legado: foto sem uploadStatus
      const p = ph("p1", 1) as Partial<Photo>;
      delete p.uploadStatus;
      const tx = raw.transaction("photos", "readwrite");
      tx.objectStore("photos").put(p);
      tx.oncomplete = () => res();
    });
    raw.close();
    expect((await v5.photos.get("p1"))!.uploadStatus).toBeUndefined(); // controle
    const v6 = createIndexedDbRepositories(name);
    expect((await v6.photos.get("p1"))!.uploadStatus).toBe("pronta");
    expect((await v6.photos.listByEvent("e1")).map((p) => p.id)).toEqual(["p1"]);
  });
});
