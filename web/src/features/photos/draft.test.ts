import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { clearPhotoDraft, loadPhotoDraft, savePhotoDraft, PHOTO_DRAFT_TTL_MS, type PhotoDraft } from "./draft";
const draft = (eventId = crypto.randomUUID(), userId = "ana"): PhotoDraft => ({ eventId, userId, createdAt: 100, photoId: crypto.randomUUID(), data: { bytes: new Uint8Array([3, 8]).buffer, type: "image/jpeg" }, caption: "Nossa festa", moment: "Agora", attempted: true, failures: 2 });
describe("rascunho local de fotos", () => {
  it("reabre bytes, legenda e identidade sem vazar entre usuário/evento", async () => {
    const d = draft();
    expect(await savePhotoDraft(d)).toEqual({ ok: true });
    expect(await loadPhotoDraft(d.eventId, d.userId, 101)).toEqual({ ok: true, draft: d });
    expect(await loadPhotoDraft(d.eventId, "beto", 101)).toEqual({ ok: true, draft: undefined });
    expect(await loadPhotoDraft("outro", d.userId, 101)).toEqual({ ok: true, draft: undefined });
  });
  it("expira em 24 horas e descarta explicitamente", async () => {
    const d = draft();
    await savePhotoDraft(d);
    expect((await loadPhotoDraft(d.eventId, d.userId, 100 + PHOTO_DRAFT_TTL_MS - 1)).draft).toEqual(d);
    expect((await loadPhotoDraft(d.eventId, d.userId, 100 + PHOTO_DRAFT_TTL_MS)).draft).toBeUndefined();
    await savePhotoDraft(d);
    expect(await clearPhotoDraft(d.eventId, d.userId)).toEqual({ ok: true });
    expect((await loadPhotoDraft(d.eventId, d.userId, 101)).draft).toBeUndefined();
  });
  it("informa indisponibilidade e quota sem prometer persistência", async () => {
    vi.stubGlobal("indexedDB", undefined);
    expect(await savePhotoDraft(draft())).toEqual({ ok: false });
    expect(await loadPhotoDraft("evento", "ana", 100)).toEqual({ ok: false });
    vi.unstubAllGlobals();
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(await savePhotoDraft(draft())).toEqual({ ok: false });
    spy.mockRestore();
  });
});

import { openDB } from "idb";
import { loadQueuedUploads, removeQueuedUpload, saveQueuedUpload, type QueuedUpload } from "./draft";
const queued = (photoId: string, userId = "ana", createdAt = 1): QueuedUpload => ({
  photoId, eventId: "ev", userId, createdAt, user: { id: userId, name: "Ana", createdAt: 1 }, event: { id: "ev" } as QueuedUpload["event"],
  data: { bytes: new Uint8Array([1]).buffer, type: "image/jpeg" }, meta: { moment: "Agora" }, attempted: false, failures: 0,
});
describe("fila de envio no mesmo banco dos rascunhos", () => {
  it("um item por photoId, só da pessoa, em ordem de disparo; remove por item", async () => {
    await saveQueuedUpload(queued("b", "ana", 2));
    await saveQueuedUpload(queued("a", "ana", 1));
    await saveQueuedUpload(queued("c", "beto", 3));
    expect((await loadQueuedUploads("ana")).items.map((i) => i.photoId)).toEqual(["a", "b"]);
    await saveQueuedUpload({ ...queued("a", "ana", 1), failures: 2 });
    expect((await loadQueuedUploads("ana")).items[0].failures).toBe(2);
    await removeQueuedUpload("a");
    expect((await loadQueuedUploads("ana")).items.map((i) => i.photoId)).toEqual(["b"]);
    await removeQueuedUpload("b"); await removeQueuedUpload("c");
  });
  it("migra o banco v1 sem perder rascunhos existentes", async () => {
    indexedDB.deleteDatabase("mm-photo-drafts");
    const d = draft();
    const v1 = await openDB("mm-photo-drafts", 1, { upgrade(db) { db.createObjectStore("drafts"); } });
    await v1.put("drafts", d, JSON.stringify([d.eventId, d.userId]));
    v1.close();
    expect((await loadPhotoDraft(d.eventId, d.userId, 101)).draft).toEqual(d);
    expect((await saveQueuedUpload(queued("z"))).ok).toBe(true);
    expect((await loadQueuedUploads("ana")).items).toHaveLength(1);
    await removeQueuedUpload("z");
  });
});
