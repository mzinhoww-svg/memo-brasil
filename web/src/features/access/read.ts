import type { MemoEvent } from "@/domain/event";
import { visiblePhotos, type Photo, type Reaction, type Viewer } from "@/domain/photo";
import { can, type Actor } from "@/domain/roles";
import { toPreview } from "@/repositories/preview";
import type { EventPreview, Participant, PhotoData, Repositories } from "@/repositories";

export type { EventPreview };

export type EventKey = { code: string } | { id: string };
export type EventAccess = "organizador" | "membro" | "convite" | "inexistente";

export interface ScopedEvent {
  access: EventAccess;
  /** Só para organizador e membro. */
  event?: MemoEvent;
  /** Só para quem ainda está no convite. */
  preview?: EventPreview;
  participants: Participant[];
  photos: Photo[];
  reactions: Reaction[];
  /** Só números, nunca conteúdo: alimentam o rolo e a tela de espera sem expor foto bloqueada. */
  counts: { mine: number; total: number };
}

const EMPTY = { participants: [], photos: [], reactions: [], counts: { mine: 0, total: 0 } };

/**
 * Leitura de um evento para um ator. Esta é a fronteira de autorização do cliente: fotos e reações que o ator não pode
 * ver nunca saem daqui. Com o backend, a mesma regra vira RLS/RPC e este módulo passa a chamar o servidor.
 */
export async function readEventScoped(repos: Repositories, key: EventKey, actor: Actor, now: number): Promise<ScopedEvent> {
  const event = "code" in key ? await repos.events.getByCode(key.code) : await repos.events.get(key.id);
  if (!event) {
    // no servidor quem ainda não entrou não enxerga o evento: a prévia vem por RPC
    const preview = "code" in key ? await repos.events.preview(key.code, now) : undefined;
    return preview ? { access: "convite", preview, ...EMPTY } : { access: "inexistente", ...EMPTY };
  }

  const isHost = can(actor, "photo.moderate", event);
  if (!isHost && !actor.userId) return { access: "convite", preview: toPreview(event, now, await repos.participants.count(event.id)), ...EMPTY };

  // Com o evento em mãos, o resto vai num único lote (uma ida em vez de quatro em série). A RLS já filtra no servidor;
  // se a pessoa ainda for "convite" (não entrou ou foi bloqueada), tudo o que veio no lote é descartado abaixo, inclusive
  // as recusas (ex.: `event_counts` nega quem não é membro): só valem depois de confirmada a participação.
  // O anfitrião não consulta a própria participação: o papel dele vem do evento.
  const settle = <T,>(p: Promise<T>) => p.then((v) => ({ ok: true as const, v }), (e: unknown) => ({ ok: false as const, e }));
  const [memberR, photosR, countsR, participantsR, reactionsR] = await Promise.all([
    isHost ? Promise.resolve({ ok: true as const, v: undefined }) : settle(repos.participants.get(event.id, actor.userId!)),
    settle(repos.photos.listByEvent(event.id)),
    settle(repos.events.counts(event.id, { userId: actor.userId, host: isHost })),
    settle(repos.participants.listByEvent(event.id)),
    settle(repos.reactions.listByEvent(event.id)),
  ]);
  if (!memberR.ok) throw memberR.e;
  const member = memberR.v;
  if (!isHost && (!member || member.blockedAt !== undefined)) {
    return { access: "convite", preview: toPreview(event, now, await repos.participants.count(event.id)), ...EMPTY };
  }
  const value = <T,>(r: { ok: true; v: T } | { ok: false; e: unknown }): T => {
    if (!r.ok) throw r.e;
    return r.v;
  };
  const [rawPhotos, counts, participants, reactions] = [value(photosR), value(countsR), value(participantsR), value(reactionsR)];

  const viewer: Viewer = { id: actor.userId ?? "", host: isHost };
  const photos = visiblePhotos(event, rawPhotos, viewer, now);
  const allowed = new Set(photos.map((p) => p.id));
  return { access: isHost ? "organizador" : "membro", event, participants, photos, reactions: reactions.filter((r) => allowed.has(r.photoId)), counts };
}

/** Bytes da foto: só se a foto estiver liberada para o ator (mesma regra da lista). */
export async function readPhotoData(repos: Repositories, actor: Actor, event: MemoEvent, photoId: string, now: number): Promise<PhotoData | undefined> {
  const photo = await repos.photos.get(photoId);
  if (!photo || photo.eventId !== event.id) return undefined;
  const isHost = can(actor, "photo.moderate", event);
  if (!isHost) {
    const member = actor.userId ? await repos.participants.get(event.id, actor.userId) : undefined;
    if (!member || member.blockedAt !== undefined) return undefined;
  }
  if (visiblePhotos(event, [photo], { id: actor.userId ?? "", host: isHost }, now).length === 0) return undefined;
  return repos.photos.getData(photoId);
}
