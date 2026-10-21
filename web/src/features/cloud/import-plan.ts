import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { RepositoryError, type Repositories } from "@/repositories";

/**
 * Pacote de migração local → nuvem (só dados, nunca bytes: as fotos sobem pelo Storage em `storagePath`).
 * Regras que a identidade da nuvem impõe (`auth.uid()` ≠ `User.id` local), conforme INTEGRATION-PLAN v2 / DECISIONS T8-T9:
 *  - só os eventos do anfitrião; mesmo `id` e `code` (idempotência por UUID); `hostId` vira o `auth.uid()`;
 *  - `photos.author_id` é nullable: foto de convidado perde o autor e guarda o nome; fotos removidas não vão;
 *  - reações e participantes têm FK para contas: só as do anfitrião (host fica fora de `participants`) são levadas;
 *  - nenhum identificador local de outras pessoas sai do aparelho.
 */
export interface ImportEvent extends Omit<MemoEvent, "hostId" | "version"> { hostId: string; version: 1 }
export interface ImportPhoto extends Omit<Photo, "authorId" | "version"> { authorId: string | null; version: 1; storagePath: string }
export type ImportReaction = Omit<Reaction, "authorId"> & { authorId: string };
export interface ImportBundle {
  events: ImportEvent[];
  photos: ImportPhoto[];
  reactions: ImportReaction[];
  report: { photosDroppedRemoved: number; photosDroppedUnfinished: number; reactionsDroppedGuests: number; guestsNotImported: number };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function buildImportBundle(repos: Repositories, who: { localUserId: string; authUid: string }): Promise<ImportBundle> {
  if (!UUID.test(who.authUid)) throw new RepositoryError("invalid", "auth.uid() inválido para a importação");
  const bundle: ImportBundle = { events: [], photos: [], reactions: [], report: { photosDroppedRemoved: 0, photosDroppedUnfinished: 0, reactionsDroppedGuests: 0, guestsNotImported: 0 } };
  const mine = (await repos.events.list()).filter((e) => e.hostId === who.localUserId).sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  for (const e of mine) {
    bundle.events.push({ ...e, hostId: who.authUid, version: 1 });
    const [photos, reactions, participants] = await Promise.all([repos.photos.listByEvent(e.id), repos.reactions.listByEvent(e.id), repos.participants.listByEvent(e.id)]);
    // fotos removidas ficam de fora por regra; envios inacabados (`enviando`/`falhou`) não são fotos ainda
    bundle.report.photosDroppedRemoved += photos.filter((p) => p.status === "removida").length;
    bundle.report.photosDroppedUnfinished += (await repos.photos.pending(e.id)).length;
    for (const p of [...photos].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))) {
      if (p.status === "removida") continue;
      const { authorId, ...rest } = p;
      bundle.photos.push({ ...rest, authorId: authorId === who.localUserId ? who.authUid : null, version: 1, uploadStatus: "pronta", storagePath: `${e.id}/${p.id}` });
    }
    const keep = new Set(photos.filter((p) => p.status !== "removida").map((p) => p.id));
    for (const r of reactions) {
      if (!keep.has(r.photoId)) continue;
      if (r.authorId === who.localUserId) bundle.reactions.push({ eventId: r.eventId, photoId: r.photoId, kind: r.kind, authorId: who.authUid });
      else bundle.report.reactionsDroppedGuests++;
    }
    bundle.report.guestsNotImported += participants.filter((p) => p.userId !== who.localUserId).length;
  }
  return bundle;
}

export type IdentityMode = "local" | "cloud";

/** Na nuvem a identidade é a da sessão (`auth.uid()`): não há troca de pessoa nem lista de identidades do aparelho. */
export function identityPolicy(mode: IdentityMode): { canSwitch: boolean; remembersPeople: boolean } {
  const local = mode === "local";
  return { canSwitch: local, remembersPeople: local };
}
