"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { now as clockNow } from "@/lib/clock";
import { createLocalScheduler } from "@/lib/services/notifications";
import type { NotificationScheduler } from "@/lib/services";
import { createLocalRepositories, createMemoryRepositories, StorageUnavailableError, type Repositories, type User } from "@/repositories";

interface AppState {
  repos: Repositories;
  /** false quando o navegador não oferece IndexedDB: nada será guardado depois de fechar. */
  persistent: boolean;
  ready: boolean;
  user: User | undefined;
  storageError: boolean;
  scheduler: NotificationScheduler;
  now: () => number;
  /** Cria (ou renomeia) a identidade local. Autenticação real depende do backend. */
  signIn: (name: string) => Promise<User>;
  signOut: () => Promise<void>;
  reportStorageError: (e: unknown) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const local = useMemo(() => createLocalRepositories(), []);
  const [repos, setRepos] = useState<Repositories>(local.repos);
  const [persistent, setPersistent] = useState(local.persistent);
  const [user, setUser] = useState<User | undefined>();
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const scheduler = useMemo(() => createLocalScheduler(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await local.repos.users.current();
        if (alive) setUser(u);
        if (local.persistent && "storage" in navigator && navigator.storage.persist) void navigator.storage.persist();
      } catch (e) {
        if (!(e instanceof StorageUnavailableError)) throw e;
        if (alive) {
          setRepos(createMemoryRepositories());
          setPersistent(false);
          setStorageError(true);
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [local]);

  const signIn = useCallback(
    async (name: string) => {
      const u: User = { id: user?.id ?? crypto.randomUUID(), name: name.trim(), createdAt: user?.createdAt ?? Date.now() };
      await repos.users.save(u);
      setUser(u);
      return u;
    },
    [repos, user],
  );
  const signOut = useCallback(async () => {
    await repos.users.clear();
    setUser(undefined);
  }, [repos]);

  const value = useMemo<AppState>(
    () => ({ repos, persistent, ready, user, storageError, scheduler, now: clockNow, signIn, signOut, reportStorageError: () => setStorageError(true) }),
    [repos, persistent, ready, user, storageError, scheduler, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fora do AppProvider");
  return v;
}
