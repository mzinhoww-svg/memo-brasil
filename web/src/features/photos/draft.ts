import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { MemoEvent } from "@/domain/event";
import type { PhotoData, User } from "@/repositories";

export const PHOTO_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export interface PhotoDraft {
  eventId: string; userId: string; createdAt: number; photoId: string;
  data: PhotoData; caption: string; moment: string; attempted: boolean; failures: number; denial?: string;
}
/**
 * Disparo na fila de envio (câmera descartável): um por foto, chave `photoId`. Guarda os bytes já revelados e tudo o que
 * o envio precisa para retomar sozinho depois de fechar o app (evento e pessoa daquele momento).
 */
export interface QueuedUpload {
  photoId: string; eventId: string; userId: string; createdAt: number;
  user: User; event: MemoEvent; data: PhotoData;
  meta: { moment: string; caption?: string; tableLabel?: string };
  attempted: boolean; failures: number;
  /** A reserva (`begin`) já foi aceita: a foto já conta no rolo do servidor. */
  reserved?: boolean;
}
interface DraftDB extends DBSchema {
  drafts: { key: string; value: PhotoDraft };
  uploads: { key: string; value: QueuedUpload };
}
type DraftResult = { ok: boolean; draft?: PhotoDraft };
const key = (eventId: string, userId: string) => JSON.stringify([eventId, userId]);
async function database() {
  // v2 só acrescenta a fila (`uploads`); os rascunhos da v1 continuam onde estavam.
  return openDB<DraftDB>("mm-photo-drafts", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore("drafts");
      if (oldVersion < 2) db.createObjectStore("uploads");
    },
  });
}
/** Store dedicado: nunca usa o repositório de fotos nem outro usuário como fallback. */
async function access<R extends { ok: boolean } = DraftResult>(action: (db: IDBPDatabase<DraftDB>) => Promise<R>): Promise<R | { ok: false }> {
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

/** Fila de envio: grava (ou atualiza) um disparo. */
export function saveQueuedUpload(item: QueuedUpload): Promise<{ ok: boolean }> {
  return access(async (db) => { await db.put("uploads", item, item.photoId); return { ok: true }; });
}
/** Disparos ainda não confirmados desta pessoa (de qualquer evento), do mais antigo ao mais novo. */
export async function loadQueuedUploads(userId: string): Promise<{ ok: boolean; items: QueuedUpload[] }> {
  const r = await access(async (db) => ({ ok: true, items: (await db.getAll("uploads")).filter((u) => u.userId === userId).sort((a, b) => a.createdAt - b.createdAt) }));
  return "items" in r ? r : { ok: false, items: [] };
}
export function removeQueuedUpload(photoId: string): Promise<{ ok: boolean }> {
  return access(async (db) => { await db.delete("uploads", photoId); return { ok: true }; });
}
