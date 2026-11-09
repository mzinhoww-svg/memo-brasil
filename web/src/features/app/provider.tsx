"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { now as clockNow } from "@/lib/clock";
import { createServerClock, type ServerClock } from "@/lib/server-clock";
import { localRevealAuthority, type RevealAuthority } from "@/features/authority";
import { identityPolicy, type IdentityMode } from "@/features/cloud/import-plan";
import { createLocalScheduler } from "@/lib/services/notifications";
import type { NotificationScheduler } from "@/lib/services";
import { createLocalRepositories, createMemoryRepositories, StorageUnavailableError, type Repositories, type User } from "@/repositories";
import { createSupabaseRepositories } from "@/repositories/supabase";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import { serverRevealAuthority } from "@/features/authority";

interface AppState {
  repos: Repositories;
  /** false quando o navegador não oferece IndexedDB: nada será guardado depois de fechar. */
  persistent: boolean;
  ready: boolean;
  user: User | undefined;
  storageError: boolean;
  scheduler: NotificationScheduler;
  /** Quem faz a revelação acontecer: local nesta fase, a tarefa agendada do servidor depois. */
  authority: RevealAuthority;
  /** Relógio corrigido pelo servidor (sem sincronização vale o do aparelho). */
  clock: ServerClock;
  now: () => number;
  /** Cria (ou renomeia) a identidade local. Autenticação real depende do backend. */
  signIn: (name: string) => Promise<User>;
  signOut: () => Promise<void>;
  /** `local` = identidade do aparelho; `cloud` = a da sessão (`auth.uid()`), sem troca de pessoa. */
  identityMode: IdentityMode;
  canSwitchIdentity: boolean;
  /** local = IndexedDB neste aparelho; supabase = servidor (RLS, Storage, revelação no servidor). */
  backend: "local" | "supabase";
  /** Pode criar evento: local sempre; na nuvem só organizador com conta (não anônimo). */
  canCreate: boolean;
  /** Organizador entra com Google (só na nuvem). `next` é um caminho do próprio site. */
  signInWithGoogle: (next?: string) => Promise<void>;
  /** Organizador recebe um link de acesso por e-mail (Supabase Auth, OTP). Devolve `null` se enviou, ou o motivo da falha. */
  signInWithEmail: (email: string, next?: string) => Promise<string | null>;
  /** Na nuvem, abre a sessão anônima do convidado (necessária até para ver a prévia do convite, com limite de tentativas por pessoa). */
  ensureSession: () => Promise<void>;
  /** Outras identidades já usadas neste aparelho (ex.: o anfitrião depois de testar como convidado). */
  known: User[];
  switchTo: (id: string) => Promise<void>;
  reportStorageError: (e: unknown) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const mode = useMemo(() => backendMode(), []);
  const local = useMemo(() => (mode === "supabase" ? { repos: createSupabaseRepositories(browserSupabase()), persistent: true } : createLocalRepositories()), [mode]);
  const [canCreate, setCanCreate] = useState(mode === "local");
  const [repos, setRepos] = useState<Repositories>(local.repos);
  const [persistent, setPersistent] = useState(local.persistent);
  const [user, setUser] = useState<User | undefined>();
  const [known, setKnown] = useState<User[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const scheduler = useMemo(() => createLocalScheduler(), []);
  const clock = useMemo(() => createServerClock({ read: clockNow }), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [u, k] = await Promise.all([local.repos.users.current(), local.repos.users.known()]);
        if (alive) {
          setUser(u);
          setKnown(k);
        }
        if (mode === "supabase") {
          const { data } = await browserSupabase().auth.getUser();
          if (alive) setCanCreate(Boolean(data.user && !data.user.is_anonymous));
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
  }, [local, mode]);

  const signIn = useCallback(
    async (name: string) => {
      const clean = name.trim();
      if (!clean) throw new Error("nome vazio");
      const u: User = { id: user?.id ?? crypto.randomUUID(), name: clean, createdAt: user?.createdAt ?? Date.now() };
      await repos.users.save(u);
      const saved = (await repos.users.current()) ?? u; // na nuvem o id é o auth.uid() da sessão, não o gerado aqui
      setUser(saved);
      setKnown(await repos.users.known());
      return saved;
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

  const ensureSession = useCallback(async () => {
    if (mode !== "supabase" || user) return;
    await repos.users.save({ id: "", name: "", createdAt: Date.now() }); // sem sessão, o adaptador entra como anônimo
    setUser(await repos.users.current());
  }, [mode, repos, user]);

  const signInWithGoogle = useCallback(
    async (next = "/criar") => {
      if (mode !== "supabase") return;
      const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      await browserSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safe)}` } });
    },
    [mode],
  );

  const signInWithEmail = useCallback(
    async (email: string, next = "/criar") => {
      if (mode !== "supabase") return "Disponível só com o servidor ligado.";
      const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      const { error } = await browserSupabase().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safe)}`, shouldCreateUser: true } });
      return error ? "Não conseguimos enviar o link agora. Confira o e-mail e tente de novo." : null;
    },
    [mode],
  );

  const value = useMemo<AppState>(
    () => ({ repos, persistent, ready, user, storageError, scheduler, authority: mode === "supabase" ? serverRevealAuthority : localRevealAuthority, clock, identityMode: mode === "supabase" ? "cloud" : "local", canSwitchIdentity: identityPolicy(mode === "supabase" ? "cloud" : "local").canSwitch, backend: mode, canCreate, signInWithGoogle, signInWithEmail, ensureSession, now: clock.now, signIn, signOut, known, switchTo, reportStorageError: () => setStorageError(true) }),
    [repos, persistent, ready, user, known, storageError, scheduler, clock, mode, canCreate, signInWithGoogle, signInWithEmail, ensureSession, signIn, signOut, switchTo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fora do AppProvider");
  return v;
}
