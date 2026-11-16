import { browserSupabase } from "@/lib/supabase/client";

/**
 * Smart Album · Minhas Fotos. Duas camadas independentes:
 *   - álbum pessoal sem biometria (favoritas/seleção), chave `smart_album_ui`;
 *   - busca facial voluntária, chave `smart_album_face_matching` + gate jurídico + versão aprovada + allowlist (só o servidor decide).
 * Na nuvem tudo passa por RPC (`smart_album_*`); o cliente nunca escolhe usuário, caminho de storage nem vê score/embedding.
 */
export type Band = "probable" | "review";
export type ReferenceSource = "google" | "upload" | "camera";
export type ItemKind = "favorite" | "selected";
export type ProfileStatus = "pending" | "ready" | "error" | null;
export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface SmartAlbumState {
  ui: boolean;
  revealed: boolean;
  face: {
    available: boolean;
    /** conta Google (sessão anônima não ativa a busca facial) */
    account: boolean;
    consentVersion: string | null;
    consented: boolean;
    consentOutdated: boolean;
    profile: ProfileStatus;
    source: ReferenceSource | null;
    job: { id: string; status: JobStatus; processed: number; eligible: number | null; errorCode: string | null } | null;
    /** contagem segura (só depois da revelação, revalidada por can_see_photo); null = não disponível */
    matches: number | null;
  };
}
export interface Match { photoId: string; band: Band; createdAt: number }
export interface Item { photoId: string; kind: ItemKind; createdAt: number }

export type SmartAlbumFailure = "disabled" | "consent" | "notrevealed" | "forbidden" | "invalid" | "rate-limited" | "unavailable";
export class SmartAlbumError extends Error {
  constructor(readonly code: SmartAlbumFailure, message?: string) {
    super(message ?? code);
    this.name = "SmartAlbumError";
  }
}
const PG: Record<string, SmartAlbumFailure> = { MM019: "disabled", MM020: "consent", MM017: "notrevealed", MM004: "forbidden", MM005: "invalid", MM006: "rate-limited", "42501": "forbidden" };
export function toSmartAlbumError(err: unknown): SmartAlbumError {
  if (err instanceof SmartAlbumError) return err;
  const e = (err ?? {}) as { code?: string; message?: string };
  return new SmartAlbumError((e.code && PG[e.code]) || "unavailable", e.message);
}

export interface SmartAlbumApi {
  state(eventId: string): Promise<SmartAlbumState>;
  items(eventId: string): Promise<Item[]>;
  setItem(photoId: string, kind: ItemKind, on: boolean): Promise<void>;
  grantConsent(eventId: string, version: string, source: ReferenceSource): Promise<void>;
  /** Cria o perfil pendente e envia a referência JÁ preparada (recomprimida, sem EXIF) ao bucket privado. */
  uploadReference(eventId: string, source: ReferenceSource, image: Blob): Promise<void>;
  requestSearch(eventId: string, idempotencyKey: string): Promise<{ jobId: string; status: JobStatus }>;
  matches(eventId: string): Promise<Match[]>;
  hideMatch(eventId: string, photoId: string): Promise<void>;
  /** Retira o consentimento e apaga referência/resultados. `purge_queued` = objeto na fila de purga (não é "já apagado"). */
  revoke(eventId: string): Promise<{ status: "purge_queued" | "done" }>;
}

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type Upload = (bucket: string, path: string, body: Blob) => Promise<{ error: unknown }>;

export function parseState(raw: unknown): SmartAlbumState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const f = (r.face ?? {}) as Record<string, unknown>;
  const j = f.job as Record<string, unknown> | null | undefined;
  return {
    ui: r.ui === true,
    revealed: r.revealed === true,
    face: {
      available: f.available === true,
      account: f.account === true,
      consentVersion: typeof f.consentVersion === "string" ? f.consentVersion : null,
      consented: f.consented === true,
      consentOutdated: f.consentOutdated === true,
      profile: (["pending", "ready", "error"].includes(String(f.profile)) ? f.profile : null) as ProfileStatus,
      source: (["google", "upload", "camera"].includes(String(f.source)) ? f.source : null) as ReferenceSource | null,
      job: j ? { id: String(j.id), status: j.status as JobStatus, processed: Number(j.processed ?? 0), eligible: typeof j.eligible === "number" ? j.eligible : null, errorCode: typeof j.errorCode === "string" ? j.errorCode : null } : null,
      matches: typeof f.matches === "number" ? f.matches : null,
    },
  };
}

export function createCloudSmartAlbum(
  rpc: Rpc = (fn, args) => browserSupabase().rpc(fn, args) as unknown as ReturnType<Rpc>,
  upload: Upload = async (bucket, path, body) => browserSupabase().storage.from(bucket).upload(path, body, { upsert: false, contentType: body.type, cacheControl: "no-store" }),
): SmartAlbumApi {
  const call = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    try {
      const { data, error } = await rpc(fn, args);
      if (error) throw toSmartAlbumError(error);
      return data;
    } catch (e) {
      throw toSmartAlbumError(e);
    }
  };
  return {
    state: async (eventId) => parseState(await call("smart_album_state", { p_event: eventId })),
    items: async (eventId) => (((await call("smart_album_my_items", { p_event: eventId })) as Array<Record<string, unknown>>) ?? [])
      .map((r) => ({ photoId: String(r.photo_id), kind: r.kind as ItemKind, createdAt: Date.parse(String(r.created_at)) })),
    setItem: async (photoId, kind, on) => void (await call("smart_album_set_item", { p_photo: photoId, p_kind: kind, p_on: on })),
    grantConsent: async (eventId, version, source) => void (await call("smart_album_grant_face_consent", { p_event: eventId, p_version: version, p_source: source, p_self_attested: true })),
    uploadReference: async (eventId, source, image) => {
      const r = (await call("smart_album_begin_reference", { p_event: eventId, p_source: source })) as { bucket: string; path: string };
      if (!r?.path || r.bucket !== "face-references") throw new SmartAlbumError("unavailable");
      const { error } = await upload(r.bucket, r.path, image);
      if (error) throw toSmartAlbumError(error);
    },
    requestSearch: async (eventId, key) => {
      const r = (await call("smart_album_request_search", { p_event: eventId, p_idempotency: key })) as { jobId: string; status: JobStatus };
      return { jobId: String(r.jobId), status: r.status };
    },
    matches: async (eventId) => (((await call("smart_album_list_matches", { p_event: eventId, p_limit: 100 })) as Array<Record<string, unknown>>) ?? [])
      .map((r) => ({ photoId: String(r.photo_id), band: r.band as Band, createdAt: Date.parse(String(r.created_at)) })),
    hideMatch: async (eventId, photoId) => void (await call("smart_album_hide_match", { p_event: eventId, p_photo: photoId })),
    revoke: async (eventId) => {
      const r = (await call("smart_album_revoke_face", { p_event: eventId })) as { status?: string };
      return { status: r?.status === "purge_queued" ? "purge_queued" : "done" };
    },
  };
}

/**
 * Modo local (demonstração e testes, sem servidor). Guarda no aparelho só preferências não biométricas (favoritas, estado do fluxo);
 * a imagem de referência NUNCA é gravada: no modo "face" a simulação só marca o perfil como pronto e devolve os resultados que o teste
 * declarou em `mm-smart-album-fake-matches` (o motor real não existe aqui). Toda foto devolvida passa pelo filtro de visibilidade de quem chama.
 */
export interface LocalCtx {
  ui: boolean;
  face: boolean;
  revealed: () => boolean;
  /** a foto é visível para quem chama (mesma regra da galeria: visiblePhotos) */
  canSee: (photoId: string) => boolean;
  /** evento da foto (no servidor vem da própria foto; o cliente não escolhe) */
  eventOf: (photoId: string) => string | undefined;
}
type LocalRow = { items: Item[]; consented: boolean; profile: ProfileStatus; source: ReferenceSource | null; job: SmartAlbumState["face"]["job"]; hidden: string[] };
export const LOCAL_FAKE_MATCHES_KEY = "mm-smart-album-fake-matches";
export const LOCAL_CONSENT_VERSION = "local-demo";

export function createLocalSmartAlbum(me: { id: string; anonymous?: boolean }, ctx: LocalCtx, storage: Pick<Storage, "getItem" | "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage): SmartAlbumApi {
  const key = (eventId: string) => `mm-smart-album-v1:${eventId}:${me.id}`;
  const read = (eventId: string): LocalRow => {
    try {
      const v = JSON.parse(storage?.getItem(key(eventId)) ?? "null") as LocalRow | null;
      if (v) return v;
    } catch { /* corrompido: recomeça */ }
    return { items: [], consented: false, profile: null, source: null, job: null, hidden: [] };
  };
  const write = (eventId: string, row: LocalRow) => { try { storage?.setItem(key(eventId), JSON.stringify(row)); } catch { /* sem armazenamento */ } };
  const fake = (eventId: string): string[] => {
    try { return ((JSON.parse(storage?.getItem(LOCAL_FAKE_MATCHES_KEY) ?? "{}") as Record<string, string[]>)[eventId] ?? []); } catch { return []; }
  };
  const faceOn = () => ctx.face && !me.anonymous;
  const visibleMatches = (eventId: string, row: LocalRow): Match[] =>
    row.job?.status === "completed" && ctx.revealed() ? fake(eventId).filter((id) => !row.hidden.includes(id) && ctx.canSee(id)).map((photoId) => ({ photoId, band: "probable" as const, createdAt: 0 })) : [];
  return {
    state: async (eventId) => {
      const row = read(eventId);
      const face = faceOn();
      return {
        ui: ctx.ui, revealed: ctx.revealed(),
        face: {
          available: face, account: !me.anonymous, consentVersion: face ? LOCAL_CONSENT_VERSION : null, consented: row.consented, consentOutdated: false,
          profile: row.profile, source: row.source, job: row.job,
          matches: face && row.consented && ctx.revealed() ? visibleMatches(eventId, row).length : null,
        },
      };
    },
    items: async (eventId) => (ctx.ui ? read(eventId).items.filter((i) => ctx.canSee(i.photoId)) : []),
    setItem: async (photoId, kind, on) => {
      if (!ctx.ui) throw new SmartAlbumError("disabled");
      const eventId = ctx.eventOf(photoId);
      if (!eventId || !ctx.canSee(photoId)) throw new SmartAlbumError("forbidden");
      const row = read(eventId);
      row.items = row.items.filter((i) => !(i.photoId === photoId && i.kind === kind));
      if (on) row.items.unshift({ photoId, kind, createdAt: Date.now() });
      write(eventId, row);
    },
    grantConsent: async (eventId, version, source) => {
      if (!faceOn()) throw new SmartAlbumError("disabled");
      if (version !== LOCAL_CONSENT_VERSION) throw new SmartAlbumError("invalid");
      write(eventId, { ...read(eventId), consented: true, source });
    },
    uploadReference: async (eventId, source, image) => {
      if (!faceOn()) throw new SmartAlbumError("disabled");
      const row = read(eventId);
      if (!row.consented) throw new SmartAlbumError("consent");
      if (!image.size) throw new SmartAlbumError("invalid");
      write(eventId, { ...row, profile: "pending", source, job: null }); // a imagem não é guardada
    },
    requestSearch: async (eventId) => {
      if (!faceOn()) throw new SmartAlbumError("disabled");
      const row = read(eventId);
      if (!row.consented) throw new SmartAlbumError("consent");
      if (!ctx.revealed()) throw new SmartAlbumError("notrevealed");
      if (!row.profile) throw new SmartAlbumError("invalid");
      const job = { id: `local-${Date.now()}`, status: "completed" as const, processed: 0, eligible: null, errorCode: null };
      write(eventId, { ...row, profile: "ready", job });
      return { jobId: job.id, status: job.status };
    },
    matches: async (eventId) => {
      if (!faceOn()) throw new SmartAlbumError("disabled");
      const row = read(eventId);
      if (!row.consented) throw new SmartAlbumError("consent");
      if (!ctx.revealed()) throw new SmartAlbumError("notrevealed");
      return visibleMatches(eventId, row);
    },
    hideMatch: async (eventId, photoId) => {
      const row = read(eventId);
      if (!row.hidden.includes(photoId)) row.hidden.push(photoId);
      write(eventId, row);
    },
    revoke: async (eventId) => {
      const row = read(eventId);
      const had = row.consented || row.profile !== null;
      write(eventId, { ...row, consented: false, profile: null, source: null, job: null, hidden: [] });
      return { status: had ? "purge_queued" : "done" };
    },
  };
}
