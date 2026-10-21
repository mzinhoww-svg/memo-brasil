import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import type { Invitation, Participant, PhotoData, Repositories, User } from "../types";

const clone = <T,>(v: T): T => structuredClone(v);

/** Adaptador em memória: testes e fallback quando o IndexedDB não existe. */
export function createMemoryRepositories(): Repositories {
  const events = new Map<string, MemoEvent>();
  const participants = new Map<string, Participant>();
  const photos = new Map<string, Photo>();
  const data = new Map<string, PhotoData>();
  const reactions = new Map<string, Reaction>();
  const invitations = new Map<string, Invitation>();
  let user: User | undefined;
  const known = new Map<string, User>();
  const pk = (e: string, u: string) => `${e}|${u}`;
  const dropWhere = <V,>(m: Map<string, V>, pred: (v: V) => boolean) => {
    for (const [k, v] of m) if (pred(v)) m.delete(k);
  };

  return {
    events: {
      list: async () => [...events.values()].map(clone),
      get: async (id) => (events.has(id) ? clone(events.get(id)!) : undefined),
      getByCode: async (code) => {
        const e = [...events.values()].find((x) => x.code === code);
        return e ? clone(e) : undefined;
      },
      save: async (e) => void events.set(e.id, clone(e)),
      remove: async (id) => void events.delete(id),
    },
    participants: {
      listByEvent: async (id) => [...participants.values()].filter((p) => p.eventId === id).map(clone),
      get: async (e, u) => (participants.has(pk(e, u)) ? clone(participants.get(pk(e, u))!) : undefined),
      put: async (p) => void participants.set(pk(p.eventId, p.userId), clone(p)),
      remove: async (e, u) => void participants.delete(pk(e, u)),
      removeByEvent: async (id) => dropWhere(participants, (p) => p.eventId === id),
    },
    photos: {
      listByEvent: async (id) => [...photos.values()].filter((p) => p.eventId === id).map(clone).sort((a, b) => b.createdAt - a.createdAt),
      get: async (id) => (photos.has(id) ? clone(photos.get(id)!) : undefined),
      add: async (p, d) => {
        photos.set(p.id, clone(p));
        data.set(p.id, { bytes: d.bytes.slice(0), type: d.type });
      },
      update: async (p) => void (photos.has(p.id) && photos.set(p.id, clone(p))),
      getData: async (id) => (data.has(id) ? { bytes: data.get(id)!.bytes.slice(0), type: data.get(id)!.type } : undefined),
      remove: async (id) => {
        photos.delete(id);
        data.delete(id);
      },
      removeByEvent: async (id) => {
        for (const p of [...photos.values()]) if (p.eventId === id) {
          photos.delete(p.id);
          data.delete(p.id);
        }
      },
    },
    reactions: {
      listByEvent: async (id) => [...reactions.values()].filter((r) => r.eventId === id).map(clone),
      put: async (r) => void reactions.set(pk(r.photoId, r.authorId), clone(r)),
      remove: async (p, a) => void reactions.delete(pk(p, a)),
      removeByPhoto: async (id) => dropWhere(reactions, (r) => r.photoId === id),
      removeByEvent: async (id) => dropWhere(reactions, (r) => r.eventId === id),
    },
    invitations: {
      listByEvent: async (id) => [...invitations.values()].filter((i) => i.eventId === id).map(clone),
      put: async (i) => void invitations.set(i.id, clone(i)),
      remove: async (id) => void invitations.delete(id),
      removeByEvent: async (id) => dropWhere(invitations, (i) => i.eventId === id),
    },
    users: {
      current: async () => (user ? clone(user) : undefined),
      save: async (u) => {
        user = clone(u);
        known.set(u.id, clone(u));
      },
      clear: async () => void (user = undefined),
      known: async () => [...known.values()].map(clone),
      switchTo: async (id) => {
        user = known.has(id) ? clone(known.get(id)!) : undefined;
        return user ? clone(user) : undefined;
      },
    },
  };
}
