import { eventStatus, type MemoEvent } from "@/domain/event";
import { visiblePhotos, type Photo, type Reaction, type Viewer } from "@/domain/photo";
import { can, type Actor } from "@/domain/roles";
import type { Participant, PhotoData, Repositories } from "@/repositories";

export type EventKey = { code: string } | { id: string };
export type EventAccess = "organizador" | "membro" | "convite" | "inexistente";

/** O que quem ainda não entrou no evento pode saber: o suficiente para o convite, nada sobre pessoas, fotos ou revelação. */
export interface EventPreview {
  code: string;
  title: string;
  category: MemoEvent["category"];
  hostName: string;
  startAt: number;
  place?: string;
  palette: MemoEvent["palette"];
  eventFont: MemoEvent["eventFont"];
  capacity: MemoEvent["capacity"];
  status: "ativo" | "encerrado";
  full: boolean;
}

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
  if (!event) return { access: "inexistente", ...EMPTY };

  const isHost = can(actor, "photo.moderate", event);
  const member = actor.userId ? await repos.participants.get(event.id, actor.userId) : undefined;
  if (!isHost && !member) {
    const full = event.capacity !== null && (await repos.participants.count(event.id)) >= event.capacity;
    return { access: "convite", preview: toPreview(event, now, full), ...EMPTY };
  }

  const viewer: Viewer = { id: actor.userId ?? "", host: isHost };
  const photos = visiblePhotos(event, await repos.photos.listByEvent(event.id), viewer, now);
  const allowed = new Set(photos.map((p) => p.id));
  const counts = {
    mine: actor.userId ? await repos.photos.count(event.id, { authorId: actor.userId, excludeStatus: "removida" }) : 0,
    total: await repos.photos.count(event.id, { excludeStatus: "removida" }),
  };
  const [participants, reactions] = await Promise.all([repos.participants.listByEvent(event.id), repos.reactions.listByEvent(event.id)]);
  return { access: isHost ? "organizador" : "membro", event, participants, photos, reactions: reactions.filter((r) => allowed.has(r.photoId)), counts };
}

function toPreview(e: MemoEvent, now: number, full: boolean): EventPreview {
  return { code: e.code, title: e.title, category: e.category, hostName: e.hostName, startAt: e.startAt, place: e.place, palette: e.palette, eventFont: e.eventFont, capacity: e.capacity, status: eventStatus(e, now), full };
}

/** Bytes da foto: só se a foto estiver liberada para o ator (mesma regra da lista). */
export async function readPhotoData(repos: Repositories, actor: Actor, event: MemoEvent, photoId: string, now: number): Promise<PhotoData | undefined> {
  const photo = await repos.photos.get(photoId);
  if (!photo || photo.eventId !== event.id) return undefined;
  const isHost = can(actor, "photo.moderate", event);
  if (!isHost && !(actor.userId && (await repos.participants.get(event.id, actor.userId)))) return undefined;
  if (visiblePhotos(event, [photo], { id: actor.userId ?? "", host: isHost }, now).length === 0) return undefined;
  return repos.photos.getData(photoId);
}
