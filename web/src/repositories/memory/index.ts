import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { beginRow, isPublished, matchesFilter, paginate, sortNewestFirst } from "../paging";
import { objectUrl } from "../object-url";
import { localCounts, toPreview } from "../preview";
import { RepositoryError, type Invitation, type Participant, type PhotoData, type Repositories, type RepositoryOptions, type User } from "../types";

const clone = <T,>(v: T): T => structuredClone(v);

/** Adaptador em memória: testes e fallback quando o IndexedDB não existe. */
export function createMemoryRepositories(opts: RepositoryOptions = {}): Repositories {
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
      preview: async (code, now) => {
        const e = [...events.values()].find((x) => x.code === code);
        return e ? toPreview(e, now, [...participants.values()].filter((p) => p.eventId === e.id).length) : undefined;
      },
      counts: async (id, who) => localCounts([...photos.values()].filter((p) => p.eventId === id), who),
      list: async () => [...events.values()].map(clone),
      get: async (id) => (events.has(id) ? clone(events.get(id)!) : undefined),
      getByCode: async (code) => {
        const e = [...events.values()].find((x) => x.code === code);
        return e ? clone(e) : undefined;
      },
      save: async (e, opts) => {
        const cur = events.get(e.id);
        if (!cur && opts?.expectedVersion !== undefined) throw new RepositoryError("not-found", `Evento ${e.id} não existe (apagado?)`);
        if (cur && opts?.expectedVersion !== undefined && cur.version !== opts.expectedVersion) throw new RepositoryError("conflict", `Evento ${e.id}: versão ${opts.expectedVersion} desatualizada (atual ${cur.version})`);
        const saved = { ...clone(e), version: cur ? cur.version + 1 : 1 };
        events.set(e.id, saved);
        return clone(saved);
      },
      remove: async (id) => void events.delete(id),
    },
    participants: {
      listByEvent: async (id) => [...participants.values()].filter((p) => p.eventId === id).map(clone),
      count: async (id) => [...participants.values()].filter((p) => p.eventId === id).length,
      get: async (e, u) => (participants.has(pk(e, u)) ? clone(participants.get(pk(e, u))!) : undefined),
      put: async (p) => void participants.set(pk(p.eventId, p.userId), clone(p)),
      remove: async (e, u) => void participants.delete(pk(e, u)),
      removeByEvent: async (id) => dropWhere(participants, (p) => p.eventId === id),
    },
    photos: {
      listByEvent: async (id) => sortNewestFirst([...photos.values()].filter((p) => p.eventId === id && isPublished(p))).map(clone),
      get: async (id) => (photos.has(id) ? clone(photos.get(id)!) : undefined),
      count: async (id, f) => [...photos.values()].filter((p) => p.eventId === id && matchesFilter(p, f)).length,
      page: async (id, o) => {
        const pg = paginate(sortNewestFirst([...photos.values()].filter((p) => p.eventId === id && isPublished(p))), o);
        return { ...pg, items: pg.items.map(clone) };
      },
      begin: async (p) => {
        if (!photos.has(p.id)) photos.set(p.id, beginRow(clone(p), opts.now));
        return clone(photos.get(p.id)!);
      },
      attach: async (id, d) => {
        if (!photos.has(id)) throw new RepositoryError("not-found", `Foto ${id} não existe`);
        data.set(id, { bytes: d.bytes.slice(0), type: d.type });
      },
      finalize: async (id) => {
        const cur = photos.get(id);
        if (!cur) throw new RepositoryError("not-found", `Foto ${id} não existe`);
        if (!data.has(id)) throw new RepositoryError("invalid", `Foto ${id} ainda não recebeu os bytes`);
        const saved = { ...cur, uploadStatus: "pronta" as const, version: cur.version + 1 };
        photos.set(id, saved);
        return clone(saved);
      },
      pending: async (id) => sortNewestFirst([...photos.values()].filter((p) => p.eventId === id && !isPublished(p))).map(clone),
      getUrl: async (id) => (data.has(id) ? objectUrl(data.get(id)!) : undefined),
      add: async (p, d) => {
        if (photos.has(p.id)) return;
        photos.set(p.id, { ...beginRow(clone(p), opts.now), uploadStatus: "pronta" });
        data.set(p.id, { bytes: d.bytes.slice(0), type: d.type });
      },
      update: async (p, opts) => {
        const cur = photos.get(p.id);
        if (!cur) throw new RepositoryError("not-found", `Foto ${p.id} não existe`);
        if (opts?.expectedVersion !== undefined && cur.version !== opts.expectedVersion) throw new RepositoryError("conflict", `Foto ${p.id}: versão ${opts.expectedVersion} desatualizada (atual ${cur.version})`);
        const saved = { ...clone(p), version: cur.version + 1 };
        photos.set(p.id, saved);
        return clone(saved);
      },
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
