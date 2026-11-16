// Smart Album · modo "pull": o motor facial (servidor próprio, sem endereço público) pergunta à Edge Function `smart-album-engine` se
// há busca na fila. A função (service_role) reserva o job pelo banco, devolve URLs assinadas de leitura e grava o resultado. O motor nunca
// recebe chave do banco; só um Bearer próprio (SMART_ALBUM_ENGINE_TOKEN). Lógica pura, testada sem Deno.
interface ClaimedJob { jobId: string; eventId: string; profileId: string; referencePath: string; photoIds: string[] }

export const PULL_ENGINE_VERSION = "opencv-yunet-sface.t3";
export const SIGN_TTL_SECONDS = 1800; // o motor processa em sequência; 30 min cobre eventos grandes
const ERR = /^[a-z_]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface PullDeps {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
  sign: (bucket: "face-references" | "event-photos", paths: string[], ttlSeconds: number) => Promise<Record<string, string>>;
}

/** SHA-256 (hex) do token do motor: o token em si fica só na Vertra; a função compara hashes (sem segredo no painel). */
export const ENGINE_TOKEN_SHA256 = "812095005a8f37cb3c64df9d7263e94c89c180e675a20ee96e50d7de4b82aa89"; // gitleaks:allow (SHA-256 público, não é o token)
export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function tokenOk(bearer: string, expectedHex = ENGINE_TOKEN_SHA256): Promise<boolean> {
  return bearer.length >= 32 && safeEqual(await sha256Hex(bearer), expectedHex);
}

export function safeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export interface PullJob { jobId: string; referenceUrl: string; photos: { id: string; url: string }[] }

/** Reserva 1 job e monta as URLs. Sem job: null. Referência sumida: o job falha aqui mesmo (perfil inválido) e devolve null. */
export async function claim(deps: PullDeps): Promise<PullJob | null> {
  const { data, error } = await deps.rpc("smart_album_worker_claim", { p_limit: 1 });
  if (error) throw new Error("claim");
  const job = ((data as ClaimedJob[] | null) ?? [])[0];
  if (!job) return null;
  const ref = (await deps.sign("face-references", [job.referencePath], SIGN_TTL_SECONDS))[job.referencePath];
  if (!ref) {
    await deps.rpc("smart_album_worker_fail", { p_job: job.jobId, p_error: "reference_missing", p_reference_invalid: true });
    return null;
  }
  const photos: { id: string; url: string }[] = [];
  const ids = job.photoIds.slice(0, 3000);
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    const urls = await deps.sign("event-photos", part.map((id) => `${job.eventId}/${id}`), SIGN_TTL_SECONDS);
    for (const id of part) if (urls[`${job.eventId}/${id}`]) photos.push({ id, url: urls[`${job.eventId}/${id}`] });
  }
  return { jobId: job.jobId, referenceUrl: ref, photos };
}

/** Grava o resultado. O banco ainda descarta foto que deixou de ser elegível (smart_album_worker_complete). */
export async function complete(deps: PullDeps, body: unknown): Promise<number> {
  const b = (body ?? {}) as { jobId?: unknown; matches?: unknown; processed?: unknown };
  if (typeof b.jobId !== "string" || !UUID.test(b.jobId) || !Array.isArray(b.matches)) throw new Error("invalid");
  const matches = (b.matches as { photoId?: unknown; band?: unknown }[])
    .filter((m) => typeof m.photoId === "string" && UUID.test(m.photoId) && (m.band === "probable" || m.band === "review"))
    .map((m) => ({ photoId: m.photoId as string, band: m.band as string }));
  const processed = typeof b.processed === "number" && b.processed >= 0 ? Math.floor(b.processed) : 0;
  const { data, error } = await deps.rpc("smart_album_worker_complete", { p_job: b.jobId, p_matches: matches, p_processed: processed, p_engine: PULL_ENGINE_VERSION });
  if (error) throw new Error("complete");
  return Number(data ?? 0);
}

export async function fail(deps: PullDeps, body: unknown): Promise<string> {
  const b = (body ?? {}) as { jobId?: unknown; error?: unknown; referenceInvalid?: unknown };
  if (typeof b.jobId !== "string" || !UUID.test(b.jobId) || typeof b.error !== "string" || !ERR.test(b.error)) throw new Error("invalid");
  const { data, error } = await deps.rpc("smart_album_worker_fail", { p_job: b.jobId, p_error: b.error, p_reference_invalid: b.referenceInvalid === true });
  if (error) throw new Error("fail");
  return String(data);
}

// ---------------------------------------------------------------------------------------------------------------- pré-processamento
// Cada foto pronta é analisada uma vez, durante o evento, contra as selfies de quem autorizou e participa. O motor recebe só URLs
// assinadas e ids opacos (foto, perfil); devolve {faces, sharpness, matches[{profileId, band}]}. O banco revalida tudo ao gravar.
export interface PhotoBatch { photos: { id: string; eventId: string; url: string }[]; refs: { eventId: string; profileId: string; url: string }[] }
const REF_ERR = new Set(["no_face", "multiple_faces", "low_quality"]);

async function signAll(deps: PullDeps, bucket: "face-references" | "event-photos", paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < paths.length; i += 200) Object.assign(out, await deps.sign(bucket, paths.slice(i, i + 200), SIGN_TTL_SECONDS));
  return out;
}

/** Reserva um lote de fotos e monta as URLs. Fila vazia: null. Foto sem URL volta à fila pelo próprio banco (lock expira). */
export async function claimPhotos(deps: PullDeps, limit = 8): Promise<PhotoBatch | null> {
  const { data, error } = await deps.rpc("smart_album_worker_claim_photos", { p_limit: limit });
  if (error) throw new Error("claim");
  const d = (data ?? {}) as { photos?: { photoId: string; eventId: string }[]; refs?: { eventId: string; profileId: string; referencePath: string }[] };
  const claimed = d.photos ?? [];
  if (!claimed.length) return null;
  const photoUrls = await signAll(deps, "event-photos", claimed.map((p) => `${p.eventId}/${p.photoId}`));
  const refList = (d.refs ?? []).slice(0, 2000);
  const refUrls = await signAll(deps, "face-references", [...new Set(refList.map((r) => r.referencePath))]);
  return {
    photos: claimed.filter((p) => photoUrls[`${p.eventId}/${p.photoId}`]).map((p) => ({ id: p.photoId, eventId: p.eventId, url: photoUrls[`${p.eventId}/${p.photoId}`] })),
    refs: refList.filter((r) => refUrls[r.referencePath]).map((r) => ({ eventId: r.eventId, profileId: r.profileId, url: refUrls[r.referencePath] })),
  };
}

/** Grava o lote. Só passam ids em formato UUID, faixas conhecidas e erros de selfie conhecidos; números são saneados. */
export async function completePhotos(deps: PullDeps, body: unknown): Promise<number> {
  const b = (body ?? {}) as { results?: unknown; failed?: unknown; refErrors?: unknown };
  if (!Array.isArray(b.results)) throw new Error("invalid");
  const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0);
  const results = (b.results as { photoId?: unknown; faces?: unknown; sharpness?: unknown; matches?: unknown }[])
    .filter((r) => typeof r.photoId === "string" && UUID.test(r.photoId))
    .slice(0, 50)
    .map((r) => ({
      photoId: r.photoId as string, faces: Math.floor(num(r.faces, 500)), sharpness: num(r.sharpness, 1e6),
      matches: (Array.isArray(r.matches) ? (r.matches as { profileId?: unknown; band?: unknown }[]) : [])
        .filter((m) => typeof m.profileId === "string" && UUID.test(m.profileId) && (m.band === "probable" || m.band === "review"))
        .map((m) => ({ profileId: m.profileId as string, band: m.band as string })),
    }));
  const failed = (Array.isArray(b.failed) ? (b.failed as unknown[]) : []).filter((v): v is string => typeof v === "string" && UUID.test(v)).slice(0, 50);
  const refErrors = (Array.isArray(b.refErrors) ? (b.refErrors as { profileId?: unknown; error?: unknown }[]) : [])
    .filter((e) => typeof e.profileId === "string" && UUID.test(e.profileId) && typeof e.error === "string" && REF_ERR.has(e.error))
    .map((e) => ({ profileId: e.profileId as string, error: e.error as string }));
  const { data, error } = await deps.rpc("smart_album_worker_complete_photos", { p_results: results, p_failed: failed, p_ref_errors: refErrors, p_engine: PULL_ENGINE_VERSION });
  if (error) throw new Error("complete");
  return Number(data ?? 0);
}
