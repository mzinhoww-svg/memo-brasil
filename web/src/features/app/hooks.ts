"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { LOCAL_ACTOR } from "@/domain/roles";
import type { Participant } from "@/repositories";
import { readEventScoped, type EventAccess, type EventPreview } from "@/features/access/read";
import { useApp } from "./provider";

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
  refresh: () => Promise<void>;
}

/** Carrega o evento (por código ou id) já escopado ao papel da pessoa atual: o que ela não pode ver não chega aqui. */
export function useEventData(key: { code?: string; id?: string }): EventData {
  const { repos, ready, user, now } = useApp();
  const userId = user?.id ?? null;
  const [state, setState] = useState<Omit<EventData, "refresh">>({ loading: true, access: "inexistente", event: undefined, preview: undefined, participants: [], photos: [], reactions: [], counts: { mine: 0, total: 0 } });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!ready) return;
    const k = key.code ? { code: key.code } : key.id ? { id: key.id } : undefined;
    const v = k ? await readEventScoped(repos, k, LOCAL_ACTOR(userId), now()) : undefined;
    if (alive.current) setState({ loading: false, access: v?.access ?? "inexistente", event: v?.event, preview: v?.preview, participants: v?.participants ?? [], photos: v?.photos ?? [], reactions: v?.reactions ?? [], counts: v?.counts ?? { mine: 0, total: 0 } });
  }, [repos, ready, key.code, key.id, userId, now]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}

/** URLs de objeto para as fotos; revoga ao sair. */
export function usePhotoUrls(photos: Photo[]): Record<string, string> {
  const { repos } = useApp();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cache = useRef<Map<string, string>>(new Map());
  const ids = photos.map((p) => p.id).join(",");

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const p of photos) {
        if (cache.current.has(p.id)) continue;
        const d = await repos.photos.getData(p.id);
        if (!d || !alive) continue;
        cache.current.set(p.id, URL.createObjectURL(new Blob([d.bytes], { type: d.type })));
        if (alive) setUrls(Object.fromEntries(cache.current)); // aparece foto a foto, sem esperar o lote
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, ids]);

  useEffect(() => {
    const map = cache.current;
    return () => {
      map.forEach((u) => URL.revokeObjectURL(u));
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
