import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from "idb";
import { inferRevealAnchor, migrateLegacyReveal } from "@/domain/reveal";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { beginRow, isPublished, matchesFilter, paginate, sortNewestFirst } from "../paging";
import { objectUrl } from "../object-url";
import { localCounts, toPreview } from "../preview";
import { RepositoryError, StorageUnavailableError, type Invitation, type Participant, type PhotoData, type Repositories, type RepositoryOptions, type User } from "../types";

interface Schema extends DBSchema {
  events: { key: string; value: MemoEvent; indexes: { code: string } };
  participants: { key: [string, string]; value: Participant; indexes: { eventId: string } };
  photos: { key: string; value: Photo; indexes: { eventId: string } };
  photoData: { key: string; value: PhotoData };
  reactions: { key: [string, string]; value: Reaction; indexes: { eventId: string; photoId: string } };
  invitations: { key: string; value: Invitation; indexes: { eventId: string } };
  meta: { key: string; value: User | User[] };
}

export const DB_NAME = "memoriesmt";

/** Migrações por versão: MIGRATIONS[i] leva o schema da versão i para i+1. Nunca edite uma já publicada. */
export type Migration = (db: IDBPDatabase<Schema>, tx: IDBPTransaction<Schema, StoreNames<Schema>[], "versionchange">) => void | Promise<void>;
export const MIGRATIONS: Migration[] = [
  (db) => {
    db.createObjectStore("events", { keyPath: "id" }).createIndex("code", "code", { unique: true });
    db.createObjectStore("participants", { keyPath: ["eventId", "userId"] }).createIndex("eventId", "eventId");
    db.createObjectStore("photos", { keyPath: "id" }).createIndex("eventId", "eventId");
    db.createObjectStore("photoData");
    const r = db.createObjectStore("reactions", { keyPath: ["photoId", "authorId"] });
    r.createIndex("eventId", "eventId");
    r.createIndex("photoId", "photoId");
    db.createObjectStore("invitations", { keyPath: "id" }).createIndex("eventId", "eventId");
    db.createObjectStore("meta");
  },
  // v2: revelação programada (reveal_enabled, reveal_at, timezone, reveal_status) no lugar de revealTiming/revealDelayDays
  async (_db, tx) => {
    const store = tx.objectStore("events");
    const now = Date.now();
    for (let cur = await store.openCursor(); cur; cur = await cur.continue()) {
      await cur.update(migrateLegacyReveal(cur.value as never, now) as never);
    }
  },
  // v3: âncora da revelação (fim + N dias, ou data fixa), deduzida dos eventos já salvos
  async (_db, tx) => {
    const store = tx.objectStore("events");
    for (let cur = await store.openCursor(); cur; cur = await cur.continue()) {
      const e = cur.value as unknown as { revealAnchor?: string; startAt: number; durationHours: number; endedAt?: number; revealEnabled: boolean; revealAt: number | null };
      if (e.revealAnchor === undefined) await cur.update({ ...cur.value, ...inferRevealAnchor(e) } as never);
    }
  },
  // v4: revealedAt (monotônico). Revelações cujo horário já passou ficam registradas como reveladas.
  async (_db, tx) => {
    const store = tx.objectStore("events");
    const now = Date.now();
    for (let cur = await store.openCursor(); cur; cur = await cur.continue()) {
      const e = cur.value as unknown as { revealedAt?: number | null; revealEnabled: boolean; revealAt: number | null };
      if (e.revealedAt === undefined) await cur.update({ ...cur.value, revealedAt: e.revealEnabled && e.revealAt !== null && e.revealAt <= now ? e.revealAt : null } as never);
    }
  },
  // v5: version (concorrência otimista) em eventos e fotos já salvos
  async (_db, tx) => {
    for (const name of ["events", "photos"] as const) {
      const store = tx.objectStore(name);
      for (let cur = await store.openCursor(); cur; cur = await cur.continue()) {
        if ((cur.value as { version?: number }).version === undefined) await cur.update({ ...cur.value, version: 1 } as never);
      }
    }
  },
  // v6: uploadStatus (envio em duas fases); fotos que já existem estão prontas
  async (_db, tx) => {
    const store = tx.objectStore("photos");
    for (let cur = await store.openCursor(); cur; cur = await cur.continue()) {
      if ((cur.value as { uploadStatus?: string }).uploadStatus === undefined) await cur.update({ ...cur.value, uploadStatus: "pronta" } as never);
    }
  },
];
export const DB_VERSION = MIGRATIONS.length;

async function open(name: string, migrations: Migration[]): Promise<IDBPDatabase<Schema>> {
  if (typeof indexedDB === "undefined") throw new StorageUnavailableError();
  try {
    return await openDB<Schema>(name, migrations.length, {
      async upgrade(db, oldVersion, newVersion, tx) {
        for (let v = oldVersion; v < (newVersion ?? migrations.length); v++) await migrations[v]?.(db, tx as never);
      },
      // outra aba com versão antiga não pode travar a atualização, e esta não pode travar as novas
      blocking() {
        void dbHandle?.close();
      },
      terminated() {
        dbHandle = undefined;
      },
    }).then((d) => (dbHandle = d));
  } catch (e) {
    throw new StorageUnavailableError(e);
  }
}
let dbHandle: IDBPDatabase<Schema> | undefined;

/** Apaga todas as linhas de um índice numa transação (acesso sem tipos: store/índice dinâmicos). */
async function wipe(db: IDBPDatabase<Schema>, store: "participants" | "reactions" | "invitations", index: "eventId" | "photoId", value: string) {
  const tx = (db as unknown as IDBPDatabase).transaction(store, "readwrite");
  const keys = await tx.store.index(index).getAllKeys(value);
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
}

/** Adaptador IndexedDB. Falhas de cota/permissão viram StorageUnavailableError. */
export function createIndexedDbRepositories(name: string = DB_NAME, migrations: Migration[] = MIGRATIONS, opts: RepositoryOptions = {}): Repositories {
  let dbp: Promise<IDBPDatabase<Schema>> | undefined;
  const db = () => (dbp ??= open(name, migrations).catch((e) => {
    dbp = undefined; // falha de abertura não fica em cache: a próxima chamada tenta de novo
    throw e;
  }));
  const guard = async <T,>(fn: (d: IDBPDatabase<Schema>) => Promise<T>): Promise<T> => {
    const d = await db();
    try {
      return await fn(d);
    } catch (e) {
      if (e instanceof RepositoryError) throw e;
      throw new StorageUnavailableError(e);
    }
  };

  return {
    events: {
      preview: (code, now) =>
        guard(async (d) => {
          const e = await d.getFromIndex("events", "code", code);
          return e ? toPreview(e, now, await d.countFromIndex("participants", "eventId", e.id)) : undefined;
        }),
      counts: (id, who) => guard(async (d) => localCounts(await d.getAllFromIndex("photos", "eventId", id), who)),
      list: () => guard((d) => d.getAll("events")),
      get: (id) => guard((d) => d.get("events", id)),
      getByCode: (code) => guard((d) => d.getFromIndex("events", "code", code)),
      save: (e, opts) =>
        guard(async (d) => {
          const tx = d.transaction("events", "readwrite");
          const cur = await tx.store.get(e.id);
          const curV = cur?.version ?? 1;
          if (!cur && opts?.expectedVersion !== undefined) throw new RepositoryError("not-found", `Evento ${e.id} não existe (apagado?)`);
          if (cur && opts?.expectedVersion !== undefined && curV !== opts.expectedVersion) throw new RepositoryError("conflict", `Evento ${e.id}: versão ${opts.expectedVersion} desatualizada (atual ${curV})`);
          const saved = { ...e, version: cur ? curV + 1 : 1 };
          await tx.store.put(saved);
          await tx.done;
          return saved;
        }),
      remove: (id) => guard((d) => d.delete("events", id)),
    },
    participants: {
      setBlocked: (e, u, blocked) => guard(async (d) => {
        const tx = d.transaction(["events", "meta", "participants"], "readwrite");
        const event = await tx.objectStore("events").get(e);
        const user = await tx.objectStore("meta").get("user") as User | undefined;
        if (!event || event.hostId !== user?.id || u === event.hostId) throw new RepositoryError("forbidden", "Somente o anfitrião pode moderar participantes");
        const store = tx.objectStore("participants");
        const p = await store.get([e, u]);
        if (!p) throw new RepositoryError("not-found", "Participante não encontrado");
        await store.put({ ...p, blockedAt: blocked ? p.blockedAt ?? opts.now?.() ?? Date.now() : undefined });
        await tx.done;
      }),
      listByEvent: (id) => guard((d) => d.getAllFromIndex("participants", "eventId", id)),
      count: (id) => guard((d) => d.countFromIndex("participants", "eventId", id)),
      get: (e, u) => guard((d) => d.get("participants", [e, u])),
      put: (p) => guard(async (d) => {
        const tx = d.transaction("participants", "readwrite");
        const cur = await tx.store.get([p.eventId, p.userId]);
        if (cur?.blockedAt !== undefined) throw new RepositoryError("blocked", "Participante bloqueado");
        const { blockedAt: _ignored, ...safe } = p; void _ignored;
        await tx.store.put(safe); await tx.done;
      }),
      remove: (e, u) => guard(async (d) => {
        const tx = d.transaction("participants", "readwrite");
        if ((await tx.store.get([e, u]))?.blockedAt !== undefined) throw new RepositoryError("blocked", "Participante bloqueado");
        await tx.store.delete([e,u]); await tx.done;
      }),
      removeByEvent: (id) => guard((d) => wipe(d, "participants", "eventId", id)),
    },
    photos: {
      listByEvent: (id) => guard(async (d) => sortNewestFirst((await d.getAllFromIndex("photos", "eventId", id)).filter(isPublished))),
      count: (id, f) => guard(async (d) => (f ? (await d.getAllFromIndex("photos", "eventId", id)).filter((p) => matchesFilter(p, f)).length : d.countFromIndex("photos", "eventId", id))),
      page: (id, o) => guard(async (d) => paginate(sortNewestFirst((await d.getAllFromIndex("photos", "eventId", id)).filter(isPublished)), o)),
      get: (id) => guard((d) => d.get("photos", id)),
      begin: (p) =>
        guard(async (d) => {
          const tx = d.transaction(["photos", "participants"], "readwrite");
          if ((await tx.objectStore("participants").get([p.eventId,p.authorId]))?.blockedAt !== undefined) throw new RepositoryError("blocked", "Participante bloqueado");
          const store = tx.objectStore("photos");
          const cur = await store.get(p.id);
          const row = cur ?? beginRow(p, opts.now);
          if (!cur) await store.put(row);
          await tx.done;
          return row;
        }),
      attach: (id, data) =>
        guard(async (d) => {
          const tx = d.transaction(["photos", "photoData", "participants"], "readwrite");
          if (!(await tx.objectStore("photos").get(id))) throw new RepositoryError("not-found", `Foto ${id} não existe`);
          await Promise.all([tx.objectStore("photoData").put(data, id), tx.done]);
        }),
      finalize: (id) =>
        guard(async (d) => {
          const tx = d.transaction(["photos", "photoData", "participants"], "readwrite");
          const cur = await tx.objectStore("photos").get(id);
          if (!cur) throw new RepositoryError("not-found", `Foto ${id} não existe`);
          if ((await tx.objectStore("participants").get([cur.eventId,cur.authorId]))?.blockedAt !== undefined) throw new RepositoryError("blocked", "Participante bloqueado");
          if (!(await tx.objectStore("photoData").get(id))) throw new RepositoryError("invalid", `Foto ${id} ainda não recebeu os bytes`);
          const saved = { ...cur, uploadStatus: "pronta" as const, version: (cur.version ?? 1) + 1 };
          await Promise.all([tx.objectStore("photos").put(saved), tx.done]);
          return saved;
        }),
      pending: (id) => guard(async (d) => sortNewestFirst((await d.getAllFromIndex("photos", "eventId", id)).filter((p) => !isPublished(p)))),
      getUrl: (id) => guard(async (d) => {
        const data = await d.get("photoData", id);
        return data ? objectUrl(data) : undefined;
      }),
      add: (p, data) =>
        guard(async (d) => {
          const tx = d.transaction(["photos", "photoData", "participants"], "readwrite");
          if ((await tx.objectStore("participants").get([p.eventId,p.authorId]))?.blockedAt !== undefined) throw new RepositoryError("blocked", "Participante bloqueado");
          if (await tx.objectStore("photos").get(p.id)) return void (await tx.done);
          await Promise.all([tx.objectStore("photos").put({ ...beginRow(p, opts.now), uploadStatus: "pronta" }), tx.objectStore("photoData").put(data, p.id), tx.done]);
        }),
      update: (p, opts) =>
        guard(async (d) => {
          const tx = d.transaction("photos", "readwrite");
          const cur = await tx.store.get(p.id);
          if (!cur) throw new RepositoryError("not-found", `Foto ${p.id} não existe`);
          const curV = cur.version ?? 1;
          if (opts?.expectedVersion !== undefined && curV !== opts.expectedVersion) throw new RepositoryError("conflict", `Foto ${p.id}: versão ${opts.expectedVersion} desatualizada (atual ${curV})`);
          const saved = { ...p, version: curV + 1 };
          await tx.store.put(saved);
          await tx.done;
          return saved;
        }),
      getData: (id) => guard((d) => d.get("photoData", id)),
      remove: (id) =>
        guard(async (d) => {
          const tx = d.transaction(["photos", "photoData", "participants"], "readwrite");
          await Promise.all([tx.objectStore("photos").delete(id), tx.objectStore("photoData").delete(id), tx.done]);
        }),
      removeByEvent: (eventId) =>
        guard(async (d) => {
          const tx = d.transaction(["photos", "photoData", "participants"], "readwrite");
          const ids = await tx.objectStore("photos").index("eventId").getAllKeys(eventId);
          await Promise.all(ids.flatMap((id) => [tx.objectStore("photos").delete(id), tx.objectStore("photoData").delete(id)]));
          await tx.done;
        }),
    },
    reactions: {
      listByEvent: (id) => guard((d) => d.getAllFromIndex("reactions", "eventId", id)),
      put: (r) => guard(async (d) => void (await d.put("reactions", r))),
      remove: (p, a) => guard((d) => d.delete("reactions", [p, a])),
      removeByPhoto: (id) => guard((d) => wipe(d, "reactions", "photoId", id)),
      removeByEvent: (id) => guard((d) => wipe(d, "reactions", "eventId", id)),
    },
    invitations: {
      listByEvent: (id) => guard((d) => d.getAllFromIndex("invitations", "eventId", id)),
      put: (i) => guard(async (d) => void (await d.put("invitations", i))),
      remove: (id) => guard((d) => d.delete("invitations", id)),
      removeByEvent: (id) => guard((d) => wipe(d, "invitations", "eventId", id)),
    },
    users: {
      current: () => guard(async (d) => (await d.get("meta", "user")) as User | undefined),
      save: (u) =>
        guard(async (d) => {
          const tx = d.transaction("meta", "readwrite");
          const known = ((await tx.store.get("known")) as User[] | undefined) ?? [];
          await tx.store.put(u, "user");
          await tx.store.put([...known.filter((k) => k.id !== u.id), u], "known");
          await tx.done;
        }),
      clear: () => guard((d) => d.delete("meta", "user")),
      known: () => guard(async (d) => ((await d.get("meta", "known")) as User[] | undefined) ?? []),
      switchTo: (id) =>
        guard(async (d) => {
          const tx = d.transaction("meta", "readwrite");
          const u = (((await tx.store.get("known")) as User[] | undefined) ?? []).find((k) => k.id === id);
          if (u) await tx.store.put(u, "user");
          await tx.done;
          return u;
        }),
    },
  };
}
