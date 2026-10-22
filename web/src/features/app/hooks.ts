"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { LOCAL_ACTOR } from "@/domain/roles";
import type { Participant, PhotoSize, PhotoUrl } from "@/repositories";
import { readEventScoped, type EventAccess, type EventPreview } from "@/features/access/read";
import { useApp } from "./provider";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids do servidor são UUID; qualquer outra coisa não existe (e não vale uma ida à rede). */
export const isUuid = (v: string): boolean => UUID.test(v);

/** Relógio reativo: atualiza a cada `ms`; `sync()` força a leitura imediata depois de uma ação que muda o tempo do evento. */
export function useClock(ms = 15_000): { now: number; sync: () => void } {
  const { now } = useApp();
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), ms);
    return () => clearInterval(id);
  }, [now, ms]);
  const sync = useCallback(() => setT(now()), [now]);
  return { now: t, sync };
}

export function useNow(ms = 15_000): number {
  return useClock(ms).now;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export interface EventData {
  loading: boolean;
  /** Como a pessoa atual se relaciona com o evento; define o que ela recebe. */
  access: EventAccess;
  event: MemoEvent | undefined;
  /** Só quando a pessoa ainda não entrou: o mínimo para o convite. */
  preview: EventPreview | undefined;
  participants: Participant[];
  photos: Photo[];
  reactions: Reaction[];
  counts: { mine: number; total: number };
  /** Código do erro quando a PRIMEIRA leitura falhou (ex.: `rate-limited`); releituras que falham mantêm os dados na tela. */
  error?: string;
  refresh: () => Promise<void>;
}

/** Releitura periódica do evento com a aba visível. */
export const EVENT_POLL_MS = 45_000;

/** Carrega o evento (por código ou id) já escopado ao papel da pessoa atual: o que ela não pode ver não chega aqui. */
export function useEventData(key: { code?: string; id?: string }): EventData {
  const { repos, ready, user, now, backend } = useApp();
  const userId = user?.id ?? null;
  const [state, setState] = useState<Omit<EventData, "refresh">>({ loading: true, access: "inexistente", event: undefined, preview: undefined, participants: [], photos: [], reactions: [], counts: { mine: 0, total: 0 } });
  const [failure, setFailure] = useState<string | undefined>();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loaded = useRef(false);
  const read = useCallback(async () => {
    if (!ready) return;
    const k = key.code ? { code: key.code } : key.id ? { id: key.id } : undefined;
    // id malformado na nuvem: "não encontrado" sem ir à rede (UX-11); qualquer outra falha vira erro tipado abaixo
    const malformed = backend === "supabase" && !!key.id && !isUuid(key.id);
    const v = k && !malformed ? await readEventScoped(repos, k, LOCAL_ACTOR(userId), now()) : undefined;
    loaded.current = true;
    if (alive.current) setState({ loading: false, access: v?.access ?? "inexistente", event: v?.event, preview: v?.preview, participants: v?.participants ?? [], photos: v?.photos ?? [], reactions: v?.reactions ?? [], counts: v?.counts ?? { mine: 0, total: 0 } });
    if (alive.current) setFailure(undefined);
  }, [repos, ready, backend, key.code, key.id, userId, now]);
  // a primeira leitura que falha vira erro tipado para a tela explicar; depois de carregada, falha de rede não derruba nada
  const refresh = useCallback(() => read().catch((e: unknown) => {
    if (loaded.current || !alive.current) return;
    setFailure(e instanceof Error && "code" in e ? String((e as { code: unknown }).code) : "unavailable");
  }), [read]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Mantém o Agora e o painel vivos: volta para a aba e a cada 45 s com a aba visível (UX-10).
  useEffect(() => {
    if (!ready) return;
    const visible = () => document.visibilityState === "visible";
    const onVisible = () => { if (visible()) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => { if (visible()) void refresh(); }, EVENT_POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, [ready, refresh]);

  return { ...state, loading: state.loading && failure === undefined, error: failure, refresh };
}

/** URLs para exibir as fotos (miniatura nas grades, inteira nas telas cheias); libera ao sair. */
export function usePhotoUrls(photos: Photo[], size: PhotoSize = "full"): Record<string, string> {
  const { repos } = useApp();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cache = useRef<Map<string, PhotoUrl>>(new Map());
  const ids = photos.map((p) => p.id).join(",");

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const p of photos) {
        if (cache.current.has(p.id)) continue;
        const u = await repos.photos.getUrl(p.id, size);
        if (!u) continue;
        if (!alive) { u.release(); continue; }
        cache.current.set(p.id, u);
        setUrls(Object.fromEntries([...cache.current].map(([id, v]) => [id, v.url]))); // aparece foto a foto, sem esperar o lote
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, ids, size]);

  useEffect(() => {
    const map = cache.current;
    return () => {
      map.forEach((u) => u.release());
      map.clear();
    };
  }, []);
  return urls;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())} · ${p(d.getMonth() + 1)} · ${d.getFullYear()}`;
}
export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}`;
}
export function relativeTime(ts: number, now: number): string {
  const m = Math.max(0, Math.round((now - ts) / 60_000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}
