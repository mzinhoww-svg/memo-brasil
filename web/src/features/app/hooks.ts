"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { LOCAL_ACTOR } from "@/domain/roles";
import type { Participant, PhotoSize, PhotoUrl } from "@/repositories";
import { readEventScoped, type EventAccess, type EventPreview, type ScopedEvent } from "@/features/access/read";
import { storeFor } from "./data-cache";
import { loadPhotoUrls, nextRenewal, peekPhotoUrls } from "./photo-urls";
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
/** Leitura mais nova que isto não se repete só porque outra tela montou (ex.: convite → câmera). */
export const EVENT_FRESH_MS = 15_000;

/** O valor guardado: `null` = não há evento para esta chave (ou o id é malformado). */
type Cached = ScopedEvent | null;
const eventStore = (repos: object) => storeFor<Cached>(repos, "evento");
const isInside = (v: Cached | undefined) => v?.access === "organizador" || v?.access === "membro";

/**
 * Atualiza na hora o evento em cache (todas as telas que o mostram), ex.: curtida otimista. A próxima leitura do servidor
 * substitui o que foi feito aqui: o servidor continua sendo a verdade.
 */
export function patchEventData(repos: object, eventId: string, fn: (v: ScopedEvent) => ScopedEvent): void {
  eventStore(repos).patch((v) => v?.event?.id === eventId, (v) => fn(v!));
}

/**
 * Carrega o evento (por código ou id) já escopado ao papel da pessoa atual: o que ela não pode ver não chega aqui.
 *
 * Lê primeiro do cache de módulo (stale-while-revalidate, chave = pessoa + código/id): ao trocar de tela o que já foi lido
 * aparece na hora e é atualizado por baixo. Só se mostra do cache, sem esperar, quem já está DENTRO do evento
 * (organizador/membro); "convite" e "inexistente" só valem se lidos nesta montagem (entrar muda a resposta).
 */
export function useEventData(key: { code?: string; id?: string }): EventData {
  const { repos, ready, user, now, backend } = useApp();
  const userId = user?.id ?? null;
  const store = eventStore(repos);
  const cacheKey = `${userId ?? "-"}|${key.code ? `c:${key.code}` : key.id ? `i:${key.id}` : "-"}`;

  // o que foi gravado no cache depois desta montagem (ou da troca de chave) vale mesmo sendo "convite"
  const [since, setSince] = useState(() => ({ key: cacheKey, seq: store.seq() }));
  if (since.key !== cacheKey) setSince({ key: cacheKey, seq: store.seq() });
  const sinceSeq = since.key === cacheKey ? since.seq : store.seq();
  const sinceRef = useRef(sinceSeq);
  useEffect(() => { sinceRef.current = sinceSeq; }, [sinceSeq]);

  const subscribe = useCallback((cb: () => void) => store.subscribe(cacheKey, cb), [store, cacheKey]);
  const entry = useSyncExternalStore(subscribe, () => store.get(cacheKey), () => undefined);
  const servable = !!entry && (entry.seq > sinceSeq || isInside(entry.value));
  const [failure, setFailure] = useState<{ key: string; code: string } | undefined>();

  const load = useCallback(async (force: boolean) => {
    if (!ready) return;
    const k = key.code ? { code: key.code } : key.id ? { id: key.id } : undefined;
    // id malformado na nuvem: "não encontrado" sem ir à rede (UX-11); qualquer outra falha vira erro tipado abaixo
    const malformed = backend === "supabase" && !!key.id && !isUuid(key.id);
    try {
      await store.revalidate(cacheKey, async () => (k && !malformed ? await readEventScoped(repos, k, LOCAL_ACTOR(userId), now()) : null), { force });
      setFailure(undefined);
    } catch (e: unknown) {
      // a primeira leitura que falha vira erro tipado para a tela explicar; depois de carregada, falha de rede não derruba nada
      const cur = store.get(cacheKey);
      if (cur && (cur.seq > sinceRef.current || isInside(cur.value))) return;
      setFailure({ key: cacheKey, code: e instanceof Error && "code" in e ? String((e as { code: unknown }).code) : "unavailable" });
    }
  }, [store, repos, ready, backend, key.code, key.id, userId, now, cacheKey]);
  /** Releitura explícita (depois de uma ação): sempre vai ao servidor, e a resposta mais nova vence. */
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    if (!ready) return;
    const e = store.get(cacheKey);
    if (e && isInside(e.value) && !e.stale && Date.now() - e.at < EVENT_FRESH_MS) return; // acabou de ser lido em outra tela
    void Promise.resolve().then(() => load(false)); // junta-se a uma leitura em andamento da mesma chave
  }, [ready, store, cacheKey, load]);

  // Mantém o Agora e o painel vivos: volta para a aba e a cada 45 s com a aba visível (UX-10).
  useEffect(() => {
    if (!ready) return;
    const visible = () => document.visibilityState === "visible";
    const onVisible = () => { if (visible()) void load(false); };
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => { if (visible()) void load(false); }, EVENT_POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, [ready, load]);

  const v = servable ? entry.value : undefined;
  const error = !servable && failure?.key === cacheKey ? failure.code : undefined;
  return {
    loading: !servable && error === undefined,
    access: v?.access ?? "inexistente", event: v?.event, preview: v?.preview,
    participants: v?.participants ?? NONE, photos: v?.photos ?? NONE, reactions: v?.reactions ?? NONE, counts: v?.counts ?? ZERO,
    error, refresh,
  };
}
const NONE: never[] = [];
const ZERO = { mine: 0, total: 0 };

/**
 * URLs para exibir as fotos (miniatura nas grades, inteira nas telas cheias). Lê do cache de módulo (`photo-urls`): a
 * mesma foto tem a mesma URL em todas as telas, as que faltam saem num único lote e as assinadas renovam antes de vencer.
 * URLs locais (object URL) continuam com dono: liberadas ao sair, como antes.
 */
export function usePhotoUrls(photos: Photo[], size: PhotoSize = "full"): Record<string, string> {
  const { repos } = useApp();
  const repo = repos.photos;
  const [loaded, setLoaded] = useState<Record<string, string>>({});
  const owned = useRef<Map<string, PhotoUrl>>(new Map());
  const ids = photos.map((p) => p.id).join(",");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const list = photos;
    const run = async () => {
      const got = await loadPhotoUrls(repo, list, size, new Set(owned.current.keys()));
      for (const [id, u] of Object.entries(got.owned)) {
        if (alive) owned.current.set(id, u);
        else u.release();
      }
      if (!alive) return;
      setLoaded((prev) => ({ ...prev, ...got.urls }));
      const next = nextRenewal(repo, list, size);
      if (next !== undefined) timer = setTimeout(() => void run(), Math.max(1_000, next - Date.now()));
    };
    void run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, ids, size]);

  useEffect(() => {
    const map = owned.current;
    return () => {
      map.forEach((u) => u.release());
      map.clear();
    };
  }, []);
  // o que já está no cache aparece no primeiro render, sem esperar o efeito
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ ...loaded, ...peekPhotoUrls(repo, photos, size) }), [loaded, repo, ids, size]);
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
