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
