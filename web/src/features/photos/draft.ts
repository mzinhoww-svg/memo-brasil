import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PhotoData } from "@/repositories";

export const PHOTO_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export interface PhotoDraft {
  eventId: string; userId: string; createdAt: number; photoId: string;
  data: PhotoData; caption: string; moment: string; attempted: boolean; failures: number; denial?: string;
}
interface DraftDB extends DBSchema {
  drafts: { key: string; value: PhotoDraft };
}
type DraftResult = { ok: boolean; draft?: PhotoDraft };
const key = (eventId: string, userId: string) => JSON.stringify([eventId, userId]);
async function database() {
  return openDB<DraftDB>("mm-photo-drafts", 1, { upgrade(db) { db.createObjectStore("drafts"); } });
}
/** Store dedicado: nunca usa o repositório de fotos nem outro usuário como fallback. */
async function access(action: (db: IDBPDatabase<DraftDB>) => Promise<DraftResult>): Promise<DraftResult> {
  let db: IDBPDatabase<DraftDB> | undefined;
  try { db = await database(); return await action(db); }
  catch { return { ok: false }; }
  finally { db?.close(); }
}
export function savePhotoDraft(draft: PhotoDraft): Promise<DraftResult> {
  return access(async (db) => { await db.put("drafts", draft, key(draft.eventId, draft.userId)); return { ok: true }; });
}
export function loadPhotoDraft(eventId: string, userId: string, now: number): Promise<DraftResult> {
  return access(async (db) => {
    // Expirados são removidos em cada abertura, inclusive de identidades anteriores.
    const tx = db.transaction("drafts", "readwrite");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if (now - cursor.value.createdAt >= PHOTO_DRAFT_TTL_MS) await cursor.delete();
      cursor = await cursor.continue();
    }
    const draft = await tx.store.get(key(eventId, userId));
    await tx.done;
    return { ok: true, draft };
  });
}
export function clearPhotoDraft(eventId: string, userId: string): Promise<DraftResult> {
  return access(async (db) => { await db.delete("drafts", key(eventId, userId)); return { ok: true }; });
}
