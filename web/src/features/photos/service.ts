import { canPost, report, setReaction, visiblePhotos, type Photo, type PostResult, type Reaction, type ReactionKind, type Viewer } from "@/domain/photo";
import type { MemoEvent } from "@/domain/event";
import { RepositoryError, retryOnConflict, type PhotoData, type Repositories, type User } from "@/repositories";
import { withLock } from "@/lib/lock";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type PostOutcome = { ok: true; photo: Photo } | { ok: false; reason: Exclude<PostResult, { ok: true }>["reason"] | "arquivo" | "armazenamento" };

export async function usedShots(repos: Repositories, eventId: string, userId: string): Promise<number> {
  return (await repos.photos.listByEvent(eventId)).filter((p) => p.authorId === userId && p.status !== "removida").length;
}

/** Publica a foto no rolo do convidado. Valida rolo, evento e tamanho antes de gravar. */
export async function postPhoto(repos: Repositories, event: MemoEvent, user: User, data: PhotoData, meta: { moment: string; caption?: string; tableLabel?: string }, now: number): Promise<PostOutcome> {
  if (!data.type.startsWith("image/") || data.bytes.byteLength === 0 || data.bytes.byteLength > MAX_PHOTO_BYTES) return { ok: false, reason: "arquivo" };
  return withLock(`foto:${event.id}:${user.id}`, () => postLocked(repos, event, user, data, meta, now));
}

async function postLocked(repos: Repositories, event: MemoEvent, user: User, data: PhotoData, meta: { moment: string; caption?: string; tableLabel?: string }, now: number): Promise<PostOutcome> {
  const verdict = canPost(event, await usedShots(repos, event.id, user.id), now);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const photo: Photo = {
    id: crypto.randomUUID(), eventId: event.id, authorId: user.id, authorName: user.name, createdAt: now,
    moment: meta.moment, caption: meta.caption?.trim() || undefined, tableLabel: meta.tableLabel, status: "visivel", reports: 0, highlighted: false, version: 1,
  };
  try {
    await repos.photos.add(photo, data);
  } catch {
    return { ok: false, reason: "armazenamento" };
  }
  return { ok: true, photo };
}

export async function loadFeed(repos: Repositories, event: MemoEvent, viewer: Viewer, now: number): Promise<Photo[]> {
  return visiblePhotos(event, await repos.photos.listByEvent(event.id), viewer, now);
}

export async function react(repos: Repositories, event: MemoEvent, photoId: string, userId: string, kind: ReactionKind): Promise<Reaction[]> {
  if (!event.reactionsEnabled) return repos.reactions.listByEvent(event.id);
  const target = await repos.photos.get(photoId);
  if (!target || target.eventId !== event.id || target.status !== "visivel") return repos.reactions.listByEvent(event.id);
  const all = await repos.reactions.listByEvent(event.id);
  const next = setReaction(all, { eventId: event.id, photoId, authorId: userId }, kind);
  const mine = next.find((r) => r.photoId === photoId && r.authorId === userId);
  if (mine) await repos.reactions.put(mine);
  else await repos.reactions.remove(photoId, userId);
  return next;
}

export async function reportPhoto(repos: Repositories, photoId: string): Promise<Photo | undefined> {
  return withLock(`denuncia:${photoId}`, async () => {
    try {
      return await retryOnConflict(async () => {
        const p = await repos.photos.get(photoId);
        if (!p || p.status === "removida") return undefined;
        return repos.photos.update(report(p), { expectedVersion: p.version });
      });
    } catch (e) {
      if (e instanceof RepositoryError && e.code === "not-found") return undefined;
      throw e;
    }
  });
}
