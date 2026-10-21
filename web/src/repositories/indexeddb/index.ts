import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from "idb";
import { migrateLegacyReveal } from "@/domain/reveal";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { StorageUnavailableError, type Invitation, type Participant, type PhotoData, type Repositories, type User } from "../types";

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
export function createIndexedDbRepositories(name: string = DB_NAME, migrations: Migration[] = MIGRATIONS): Repositories {
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
      if (e instanceof StorageUnavailableError) throw e;
      throw new StorageUnavailableError(e);
    }
  };

  return {
    events: {
      list: () => guard((d) => d.getAll("events")),
      get: (id) => guard((d) => d.get("events", id)),
      getByCode: (code) => guard((d) => d.getFromIndex("events", "code", code)),
      save: (e) => guard(async (d) => void (await d.put("events", e))),
      remove: (id) => guard((d) => d.delete("events", id)),
    },
    participants: {
      listByEvent: (id) => guard((d) => d.getAllFromIndex("participants", "eventId", id)),
      get: (e, u) => guard((d) => d.get("participants", [e, u])),
      put: (p) => guard(async (d) => void (await d.put("participants", p))),
      remove: (e, u) => guard((d) => d.delete("participants", [e, u])),
      removeByEvent: (id) => guard((d) => wipe(d, "participants", "eventId", id)),
    },
    photos: {
      listByEvent: (id) => guard(async (d) => (await d.getAllFromIndex("photos", "eventId", id)).sort((a, b) => b.createdAt - a.createdAt)),
      get: (id) => guard((d) => d.get("photos", id)),
      add: (p, data) =>
        guard(async (d) => {
          const tx = d.transaction(["photos", "photoData"], "readwrite");
          await Promise.all([tx.objectStore("photos").put(p), tx.objectStore("photoData").put(data, p.id), tx.done]);
        }),
      update: (p) =>
        guard(async (d) => {
          const tx = d.transaction("photos", "readwrite");
          if (await tx.store.get(p.id)) await tx.store.put(p);
          await tx.done;
        }),
      getData: (id) => guard((d) => d.get("photoData", id)),
      remove: (id) =>
        guard(async (d) => {
          const tx = d.transaction(["photos", "photoData"], "readwrite");
          await Promise.all([tx.objectStore("photos").delete(id), tx.objectStore("photoData").delete(id), tx.done]);
        }),
      removeByEvent: (eventId) =>
        guard(async (d) => {
          const tx = d.transaction(["photos", "photoData"], "readwrite");
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
