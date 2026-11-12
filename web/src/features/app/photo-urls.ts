import type { Photo } from "@/domain/photo";
import type { PhotoRepository, PhotoSize, PhotoUrl } from "@/repositories";

/**
 * Cache de URLs de foto no escopo do MÓDULO, por (foto, tamanho), para cada repositório de fotos.
 *
 * - URLs assinadas (têm `expiresAt`) ficam guardadas e são as MESMAS entre telas: o navegador reaproveita a imagem que já
 *   baixou em vez de baixar de novo a cada assinatura. São renovadas antes de vencer (`RENEW_BEFORE_MS`).
 * - URLs locais (object URL, sem `expiresAt`) não entram aqui: seguram os bytes na memória, então continuam com dono —
 *   quem pediu libera ao desmontar, como antes.
 * - As que faltam saem num único lote (`getUrls`; sem ele, `getUrl` em paralelo), e pedidos simultâneos da mesma foto se
 *   juntam. O cache não decide quem vê o quê: só guarda URLs que o servidor aceitou assinar para a sessão atual.
 */
export const RENEW_BEFORE_MS = 5 * 60_000;

interface Cache {
  urls: Map<string, PhotoUrl>;
  inflight: Map<string, Promise<PhotoUrl | undefined>>;
}
const caches = new WeakMap<object, Cache>();
const keyOf = (id: string, size: PhotoSize) => `${size}:${id}`;
const fresh = (u: PhotoUrl | undefined, now: number): u is PhotoUrl => !!u && u.expiresAt !== undefined && u.expiresAt - now > RENEW_BEFORE_MS;

function cacheOf(repo: object): Cache {
  let c = caches.get(repo);
  if (!c) caches.set(repo, (c = { urls: new Map(), inflight: new Map() }));
  return c;
}

/** O que já está no cache e vale: aparece na hora, sem esperar rede. */
export function peekPhotoUrls(repo: object, photos: Pick<Photo, "id">[], size: PhotoSize, now = Date.now()): Record<string, string> {
  const c = caches.get(repo);
  const out: Record<string, string> = {};
  if (!c) return out;
  for (const p of photos) {
    const u = c.urls.get(keyOf(p.id, size));
    if (fresh(u, now)) out[p.id] = u.url;
  }
  return out;
}

async function fetchBatch(repo: PhotoRepository, photos: Pick<Photo, "id" | "eventId">[], size: PhotoSize): Promise<Record<string, PhotoUrl>> {
  try {
    if (repo.getUrls) return await repo.getUrls(photos, size);
    const got = await Promise.all(photos.map(async (p) => [p.id, await repo.getUrl(p.id, size)] as const));
    const out: Record<string, PhotoUrl> = {};
    for (const [id, u] of got) if (u) out[id] = u;
    return out;
  } catch {
    return {}; // sem rede ou recusa: a foto fica sem URL e a próxima tela tenta de novo
  }
}

export interface LoadedUrls {
  urls: Record<string, string>;
  /** URLs sem validade (locais) que NÃO ficaram no cache: quem chamou deve liberar com `release()`. */
  owned: Record<string, PhotoUrl>;
}

/** Garante URLs válidas para `photos` (um lote para as que faltam ou estão para vencer). `skip`: ids que o chamador já tem. */
export async function loadPhotoUrls(repo: PhotoRepository, photos: Pick<Photo, "id" | "eventId">[], size: PhotoSize, skip: ReadonlySet<string> = new Set()): Promise<LoadedUrls> {
  const c = cacheOf(repo);
  const now = Date.now();
  const missing = photos.filter((p) => !skip.has(p.id) && !fresh(c.urls.get(keyOf(p.id, size)), now) && !c.inflight.has(keyOf(p.id, size)));
  const owned: Record<string, PhotoUrl> = {};
  if (missing.length) {
    const batch = fetchBatch(repo, missing, size);
    for (const p of missing) c.inflight.set(keyOf(p.id, size), batch.then((r) => r[p.id]));
    const got = await batch;
    for (const p of missing) {
      const k = keyOf(p.id, size);
      c.inflight.delete(k);
      const u = got[p.id];
      if (!u) continue;
      if (u.expiresAt === undefined) { owned[p.id] = u; continue; }
      c.urls.set(k, u);
      // miniatura que caiu na original: a mesma URL serve para a foto aberta, sem nova assinatura
      if (size === "thumb" && u.size === "full" && !fresh(c.urls.get(keyOf(p.id, "full")), now)) c.urls.set(keyOf(p.id, "full"), u);
    }
  }
  await Promise.all(photos.map((p) => c.inflight.get(keyOf(p.id, size))));
  const urls = peekPhotoUrls(repo, photos, size);
  for (const [id, u] of Object.entries(owned)) urls[id] = u.url;
  return { urls, owned };
}

/** Quando a primeira URL guardada destas fotos precisa ser renovada (ms), se alguma vence. */
export function nextRenewal(repo: object, photos: Pick<Photo, "id">[], size: PhotoSize): number | undefined {
  const c = caches.get(repo);
  let next: number | undefined;
  for (const p of photos) {
    const at = c?.urls.get(keyOf(p.id, size))?.expiresAt;
    if (at !== undefined) next = Math.min(next ?? Infinity, at - RENEW_BEFORE_MS);
  }
  return next;
}

/** Testes. */
export function resetPhotoUrlCache(repo: object): void {
  caches.delete(repo);
}
