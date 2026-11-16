// Smart Album · modo "pull": o motor facial (servidor próprio, sem endereço público) pergunta à Edge Function `smart-album-engine` se
// há busca na fila. A função (service_role) reserva o job pelo banco, devolve URLs assinadas de leitura e grava o resultado. O motor nunca
// recebe chave do banco; só um Bearer próprio (SMART_ALBUM_ENGINE_TOKEN). Lógica pura, testada sem Deno.
import type { ClaimedJob } from "./smart-album-worker.ts";

export const PULL_ENGINE_VERSION = "opencv-yunet-sface.t1";
export const SIGN_TTL_SECONDS = 1800; // o motor processa em sequência; 30 min cobre eventos grandes
const ERR = /^[a-z_]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface PullDeps {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
  sign: (bucket: "face-references" | "event-photos", paths: string[], ttlSeconds: number) => Promise<Record<string, string>>;
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
