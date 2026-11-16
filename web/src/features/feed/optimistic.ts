import type { MemoEvent } from "@/domain/event";
import { setReaction, type Reaction, type ReactionKind } from "@/domain/photo";
import type { Repositories } from "@/repositories";
import { patchEventData } from "@/features/app/hooks";
import { react } from "@/features/photos/service";

/**
 * Curtida otimista: a reação aparece na hora em todas as telas que mostram o evento (cache de módulo), a gravação vai ao
 * servidor e, em segundo plano, só as reações são relidas para reconciliar (sem reler o evento inteiro). Se a gravação
 * falhar, desfaz a reação desta pessoa nesta foto e devolve `false`. O servidor continua sendo a verdade.
 */
export async function reactOptimistic(repos: Repositories, event: MemoEvent, photoId: string, userId: string, kind: ReactionKind, now: number, before: Reaction | undefined): Promise<boolean> {
  const target = { eventId: event.id, photoId, authorId: userId };
  patchEventData(repos, event.id, (v) => ({ ...v, reactions: setReaction(v.reactions, target, kind) }));
  let ok = true;
  try {
    await react(repos, event, photoId, userId, kind, now);
  } catch {
    ok = false;
    patchEventData(repos, event.id, (v) => ({ ...v, reactions: [...v.reactions.filter((r) => !(r.photoId === photoId && r.authorId === userId)), ...(before ? [before] : [])] }));
  }
  void repos.reactions.listByEvent(event.id).then((list) => patchEventData(repos, event.id, (v) => {
    const allowed = new Set(v.photos.map((p) => p.id));
    return { ...v, reactions: list.filter((r) => allowed.has(r.photoId)) };
  }), () => undefined);
  return ok;
}
