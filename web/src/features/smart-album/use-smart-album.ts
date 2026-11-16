"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isRevealed } from "@/domain/event";
import { visiblePhotos } from "@/domain/photo";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import { localFlags } from "./flags";
import { createCloudSmartAlbum, createLocalSmartAlbum, SmartAlbumError, toSmartAlbumError, type Item, type Match, type SmartAlbumApi, type SmartAlbumState } from "./service";

/** Visibilidade da aba "Minhas Fotos": na nuvem, a chave do servidor (cache curto por evento); no modo local, a chave local. */
const uiCache = new Map<string, { at: number; on: boolean }>();
const UI_TTL = 5 * 60_000;
export function resetSmartAlbumUiCache(): void { uiCache.clear(); }

export function useSmartAlbumUi(eventId: string | undefined): boolean {
  const backend = backendMode(); // mesma fonte do AppProvider; não exige o provider (a barra de abas também roda em telas de desenho)
  const cached = eventId ? uiCache.get(eventId) : undefined;
  const [on, setOn] = useState<boolean>(() => (backend === "supabase" ? Boolean(cached?.on) : localFlags().ui));
  useEffect(() => {
    if (!eventId || backend !== "supabase") return;
    const c = uiCache.get(eventId);
    if (c && Date.now() - c.at < UI_TTL) return; // já valia no primeiro render (estado inicial vem do cache)
    let live = true;
    void (async () => {
      try {
        const { data, error } = await browserSupabase().rpc("smart_album_ui_enabled", { p_event: eventId });
        const v = !error && data === true;
        uiCache.set(eventId, { at: Date.now(), on: v });
        if (live) setOn(v);
      } catch { /* sem servidor: a aba fica escondida */ }
    })();
    return () => { live = false; };
  }, [eventId, backend]);
  return on;
}

export interface SmartAlbum {
  api: SmartAlbumApi;
  state: SmartAlbumState | null;
  items: Item[];
  matches: Match[];
  loading: boolean;
  error: SmartAlbumError | null;
  reload: () => Promise<void>;
  googleMeta: () => Promise<unknown>;
}

/** Estado do Smart Album para o convidado atual. Toda foto listada passa por `visiblePhotos` (a mesma regra do feed) além do servidor. */
export function useSmartAlbum(): SmartAlbum {
  const { backend } = useApp();
  const { event, user, viewer, now, photos } = useGuest();
  const visibleIds = useMemo(() => new Set(visiblePhotos(event, photos, viewer, now).map((p) => p.id)), [event, photos, viewer, now]);
  const revealed = isRevealed(event, now);

  const api = useMemo<SmartAlbumApi>(() => {
    if (backend === "supabase") return createCloudSmartAlbum();
    const f = localFlags();
    const ids = new Set(photos.map((p) => p.id));
    return createLocalSmartAlbum({ id: user.id, anonymous: user.anonymous }, {
      ui: f.ui, face: f.face, revealed: () => revealed, canSee: (id) => visibleIds.has(id), eventOf: (id) => (ids.has(id) ? event.id : undefined),
    });
  }, [backend, user.id, user.anonymous, revealed, visibleIds, photos, event.id]);

  const [state, setState] = useState<SmartAlbumState | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SmartAlbumError | null>(null);

  const reload = useCallback(async () => {
    try {
      const s = await api.state(event.id);
      setState(s);
      setError(null);
      const [it, m] = await Promise.all([
        s.ui ? api.items(event.id).catch(() => [] as Item[]) : Promise.resolve([] as Item[]),
        s.face.available && s.face.consented && s.revealed ? api.matches(event.id).catch(() => [] as Match[]) : Promise.resolve([] as Match[]),
      ]);
      setItems(it.filter((i) => visibleIds.has(i.photoId)));
      setMatches(m.filter((x) => visibleIds.has(x.photoId)));
    } catch (e) {
      setError(toSmartAlbumError(e));
    } finally {
      setLoading(false);
    }
  }, [api, event.id, visibleIds]);

  useEffect(() => {
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [reload]);

  // job em andamento: consulta o estado com folga (o worker é assíncrono); para quando termina ou a tela sai
  const jobStatus = state?.face.job?.status;
  useEffect(() => {
    if (jobStatus !== "queued" && jobStatus !== "processing") return;
    const t = setInterval(() => void reload(), 8000);
    return () => clearInterval(t);
  }, [jobStatus, reload]);

  const googleMeta = useCallback(async (): Promise<unknown> => {
    if (backend !== "supabase") return null;
    try { return (await browserSupabase().auth.getUser()).data.user?.user_metadata ?? null; } catch { return null; }
  }, [backend]);

  return { api, state, items, matches, loading, error, reload, googleMeta };
}
