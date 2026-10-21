"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import type { Participant } from "@/repositories";
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
  event: MemoEvent | undefined;
  participants: Participant[];
  photos: Photo[];
  reactions: Reaction[];
  refresh: () => Promise<void>;
}

/** Carrega o evento (por código ou id) com participantes, fotos e reações do armazenamento local. */
export function useEventData(key: { code?: string; id?: string }): EventData {
  const { repos, ready } = useApp();
  const [state, setState] = useState<Omit<EventData, "refresh">>({ loading: true, event: undefined, participants: [], photos: [], reactions: [] });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!ready) return;
    const event = key.code ? await repos.events.getByCode(key.code) : key.id ? await repos.events.get(key.id) : undefined;
    if (!event) {
      if (alive.current) setState({ loading: false, event: undefined, participants: [], photos: [], reactions: [] });
      return;
    }
    const [participants, photos, reactions] = await Promise.all([repos.participants.listByEvent(event.id), repos.photos.listByEvent(event.id), repos.reactions.listByEvent(event.id)]);
    if (alive.current) setState({ loading: false, event, participants, photos, reactions });
  }, [repos, ready, key.code, key.id]);

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
      }
      if (alive) setUrls(Object.fromEntries(cache.current));
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
