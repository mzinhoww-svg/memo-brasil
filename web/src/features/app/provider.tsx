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
  /** Outras identidades já usadas neste aparelho (ex.: o anfitrião depois de testar como convidado). */
  known: User[];
  switchTo: (id: string) => Promise<void>;
  reportStorageError: (e: unknown) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const local = useMemo(() => createLocalRepositories(), []);
  const [repos, setRepos] = useState<Repositories>(local.repos);
  const [persistent, setPersistent] = useState(local.persistent);
  const [user, setUser] = useState<User | undefined>();
  const [known, setKnown] = useState<User[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const scheduler = useMemo(() => createLocalScheduler(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [u, k] = await Promise.all([local.repos.users.current(), local.repos.users.known()]);
        if (alive) {
          setUser(u);
          setKnown(k);
        }
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
      const clean = name.trim();
      if (!clean) throw new Error("nome vazio");
      const u: User = { id: user?.id ?? crypto.randomUUID(), name: clean, createdAt: user?.createdAt ?? Date.now() };
      await repos.users.save(u);
      setUser(u);
      setKnown(await repos.users.known());
      return u;
    },
    [repos, user],
  );
  const signOut = useCallback(async () => {
    await repos.users.clear();
    setUser(undefined);
  }, [repos]);
  const switchTo = useCallback(
    async (id: string) => {
      setUser(await repos.users.switchTo(id));
    },
    [repos],
  );

  // escrita que falha (cota, bloqueio) em qualquer ação vira aviso global em vez de erro mudo
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof StorageUnavailableError) {
        e.preventDefault();
        setStorageError(true);
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  const value = useMemo<AppState>(
    () => ({ repos, persistent, ready, user, storageError, scheduler, now: clockNow, signIn, signOut, known, switchTo, reportStorageError: () => setStorageError(true) }),
    [repos, persistent, ready, user, known, storageError, scheduler, signIn, signOut, switchTo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fora do AppProvider");
  return v;
}
