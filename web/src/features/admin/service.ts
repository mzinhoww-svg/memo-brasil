import { hide, moderationQueue, remove, toggleHighlight, unhide, type Photo } from "@/domain/photo";
import { eventStatus, type MemoEvent } from "@/domain/event";
import { RepositoryError, retryOnConflict, type Participant, type Repositories } from "@/repositories";

export interface EventStats {
  photos: number;
  guests: number;
  reactions: number;
  pending: number;
  status: "ativo" | "encerrado";
  byMoment: { moment: string; count: number }[];
}

export async function eventStats(repos: Repositories, e: MemoEvent, now: number): Promise<EventStats> {
  const photos = (await repos.photos.listByEvent(e.id)).filter((p) => p.status !== "removida");
  const byMoment = new Map<string, number>();
  for (const p of photos) byMoment.set(p.moment, (byMoment.get(p.moment) ?? 0) + 1);
  return {
    photos: photos.length,
    guests: (await repos.participants.listByEvent(e.id)).length,
    reactions: (await repos.reactions.listByEvent(e.id)).length,
    pending: moderationQueue(photos).length,
    status: eventStatus(e, now),
    byMoment: [...byMoment].map(([moment, count]) => ({ moment, count })).sort((a, b) => b.count - a.count),
  };
}

export type ModerationAction = "ocultar" | "mostrar" | "remover" | "destacar";

export async function moderate(repos: Repositories, photoId: string, action: ModerationAction): Promise<Photo | undefined> {
  try {
    return await retryOnConflict(async () => {
      const p = await repos.photos.get(photoId);
      if (!p) return undefined;
      const next = action === "ocultar" ? hide(p) : action === "mostrar" ? unhide(p) : action === "remover" ? remove(p) : toggleHighlight(p);
      const saved = await repos.photos.update(next, { expectedVersion: p.version });
      if (saved.status === "removida") await repos.reactions.removeByPhoto(photoId);
      return saved;
    });
  } catch (e) {
    if (e instanceof RepositoryError && e.code === "not-found") return undefined; // a foto saiu no meio da operação
    throw e;
  }
}

/** Guests ordenados por fotos postadas (DataRow do admin). */
export async function guestRanking(repos: Repositories, e: MemoEvent): Promise<{ participant: Participant; photos: number }[]> {
  const photos = (await repos.photos.listByEvent(e.id)).filter((p) => p.status !== "removida");
  return (await repos.participants.listByEvent(e.id))
    .map((participant) => ({ participant, photos: photos.filter((p) => p.authorId === participant.userId).length }))
    .sort((a, b) => b.photos - a.photos || a.participant.name.localeCompare(b.participant.name, "pt-BR"));
}

export async function removeGuest(repos: Repositories, eventId: string, userId: string): Promise<void> {
  await blockGuest(repos, eventId, userId);
}

export async function blockGuest(repos: Repositories, eventId: string, userId: string): Promise<void> {
  if (!repos.participants.setBlocked) throw new RepositoryError("unavailable", "Moderação indisponível");
  await repos.participants.setBlocked(eventId, userId, true);
}

export async function unblockGuest(repos: Repositories, eventId: string, userId: string): Promise<void> {
  if (!repos.participants.setBlocked) throw new RepositoryError("unavailable", "Moderação indisponível");
  await repos.participants.setBlocked(eventId, userId, false);
}
