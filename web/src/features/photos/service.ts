import { canPost, report, setReaction, visiblePhotos, type Photo, type PostResult, type Reaction, type ReactionKind, type Viewer } from "@/domain/photo";
import type { MemoEvent } from "@/domain/event";
import { RepositoryError, StorageUnavailableError, retryOnConflict, type PhotoData, type Repositories, type User } from "@/repositories";
import { withLock } from "@/lib/lock";
import { takeFault } from "@/lib/test-faults";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type PostOutcome = { ok: true; photo: Photo } | { ok: false; reason: Exclude<PostResult, { ok: true }>["reason"] | "arquivo" | "armazenamento" | "rede" | "falha" | "bloqueado" | "acesso" | "nao-encontrado" };

export async function usedShots(repos: Repositories, eventId: string, userId: string): Promise<number> {
  return (await repos.events.counts(eventId, { userId, host: false })).mine;
}

/** Publica a foto no rolo do convidado. Valida rolo, evento e tamanho antes de gravar. */
export interface PostOptions {
  /** Identidade da foto: a mesma em todas as tentativas, porque `begin_photo` é idempotente e a quota só desconta uma vez. */
  photoId?: string;
  /** Nova tentativa de uma foto já reservada: o rolo já a contou, então não a barra de novo (o servidor segue como autoridade). */
  resume?: boolean;
}

/** Tentativas automáticas depois de uma falha de rede: 2 s, 5 s e 15 s. Depois disso, só manual ("Tentar agora"). */
export const RETRY_DELAYS_MS = [2000, 5000, 15000] as const;
export function retryDelayMs(attempt: number): number | null {
  return RETRY_DELAYS_MS[attempt - 1] ?? null;
}

export async function postPhoto(repos: Repositories, event: MemoEvent, user: User, data: PhotoData, meta: { moment: string; caption?: string; tableLabel?: string }, now: number, opts: PostOptions = {}): Promise<PostOutcome> {
  if (!data.type.startsWith("image/") || data.bytes.byteLength === 0 || data.bytes.byteLength > MAX_PHOTO_BYTES) return { ok: false, reason: "arquivo" };
  return withLock(`foto:${event.id}:${user.id}`, () => postLocked(repos, event, user, data, meta, now, opts));
}

/** Falha de rede (tentar de novo) × falha de armazenamento do aparelho (liberar espaço) × qualquer outra coisa. */
function classify(e: unknown): "rede" | "armazenamento" | "falha" {
  if (e instanceof StorageUnavailableError || (e instanceof DOMException && e.name === "QuotaExceededError")) return "armazenamento";
  if (e instanceof RepositoryError && e.code === "unavailable") return "rede";
  return "falha";
}

async function postLocked(repos: Repositories, event: MemoEvent, user: User, data: PhotoData, meta: { moment: string; caption?: string; tableLabel?: string }, now: number, opts: PostOptions): Promise<PostOutcome> {
  const photo: Photo = {
    id: opts.photoId ?? crypto.randomUUID(), eventId: event.id, authorId: user.id, authorName: user.name, createdAt: now,
    moment: meta.moment, caption: meta.caption?.trim() || undefined, tableLabel: meta.tableLabel, status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "enviando",
  };
  try {
    if (!opts.resume) {
      const verdict = canPost(event, await usedShots(repos, event.id, user.id), now);
      if (!verdict.ok) return { ok: false, reason: verdict.reason };
    }
    // envio em duas fases: a linha reserva o rolo, os bytes seguem, e só então a foto fica visível
    await repos.photos.begin(photo);
    if (takeFault("attach")) throw new RepositoryError("unavailable", "falha de rede simulada");
    await repos.photos.attach(photo.id, data);
    const published = await repos.photos.finalize(photo.id);
    return { ok: true, photo: published };
  } catch (e) {
    // o servidor tem a palavra final sobre rolo e encerramento (AC-07): a recusa vira a mesma razão da interface
    if (e instanceof RepositoryError && e.code === "shot-limit") return { ok: false, reason: "rolo" };
    if (e instanceof RepositoryError && e.code === "event-ended") return { ok: false, reason: "encerrado" };
    if (e instanceof RepositoryError) {
      // `blocked` é compartilhado com o contrato MM015 da moderação.
      const code: string = e.code;
      const denial = code === "blocked" ? "bloqueado" : code === "forbidden" ? "acesso" : code === "not-found" ? "nao-encontrado" : undefined;
      if (denial) return { ok: false, reason: denial };
    }
    const reason = classify(e);
    // Uma resposta perdida pode seguir uma publicação confirmada. Nunca DELETE aqui:
    // a mesma identidade permite retomar; reservas pendentes ficam para a expiração existente.
    return { ok: false, reason };
  }
}

export async function loadFeed(repos: Repositories, event: MemoEvent, viewer: Viewer, now: number): Promise<Photo[]> {
  return visiblePhotos(event, await repos.photos.listByEvent(event.id), viewer, now);
}

/** Reage a uma foto que a pessoa pode ver (mesma regra da leitura). Devolve só as reações dessa foto; bloqueada = []. */
export async function react(repos: Repositories, event: MemoEvent, photoId: string, userId: string, kind: ReactionKind, now: number = Date.now()): Promise<Reaction[]> {
  if (!event.reactionsEnabled) return [];
  const target = await repos.photos.get(photoId);
  if (!target || target.eventId !== event.id || target.uploadStatus !== "pronta") return [];
  if (visiblePhotos(event, [target], { id: userId, host: event.hostId === userId }, now).length === 0) return [];
  const all = await repos.reactions.listByEvent(event.id);
  const next = setReaction(all, { eventId: event.id, photoId, authorId: userId }, kind);
  const mine = next.find((r) => r.photoId === photoId && r.authorId === userId);
  if (mine) await repos.reactions.put(mine);
  else await repos.reactions.remove(photoId, userId);
  return next.filter((r) => r.photoId === photoId);
}

/** Remove envios inacabados (`enviando`/`falhou`) mais velhos que o prazo: deixam de ocupar o rolo. Devolve quantos saíram. */
export async function expirePending(repos: Repositories, eventId: string, now: number, ttlMs: number): Promise<number> {
  const stale = (await repos.photos.pending(eventId)).filter((p) => now - p.createdAt >= ttlMs);
  for (const p of stale) await repos.photos.remove(p.id);
  return stale.length;
}

export async function reportPhoto(repos: Repositories, photoId: string): Promise<Photo | undefined> {
  if (repos.photos.report) { await repos.photos.report(photoId); return undefined; }
  return withLock(`denuncia:${photoId}`, async () => {
    try {
      return await retryOnConflict(async () => {
        const p = await repos.photos.get(photoId);
        if (!p || p.status === "removida") return undefined;
        return repos.photos.update(report(p), { expectedVersion: p.version });
      });
    } catch (e) {
      if (e instanceof RepositoryError && e.code === "not-found") return undefined;
      throw e;
    }
  });
}
