// Worker do Smart Album (lógica pura; a Edge Function `smart-album-worker` só injeta o cliente e o motor).
// Fluxo por job: o banco escolhe as fotos elegíveis (mesma regra da galeria, "como" o titular) → baixa a referência do bucket privado →
// valida bytes (assinatura/dimensões reais) → motor analisa → compara foto a foto → devolve só {photoId, band}. O banco ainda descarta
// qualquer foto que tenha deixado de ser elegível. Nada de bytes, template, score ou caminho vai para log; o handle é descartado sempre.

import { sniffImage } from "./image-sniff.ts";
import type { ConfidenceBand, FaceEngine } from "./face-engine.ts";

export interface ClaimedJob { jobId: string; eventId: string; profileId: string; referencePath: string; photoIds: string[] }
export interface WorkerDeps {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  /** Baixa um objeto privado (service_role). `null` = não existe. */
  download: (bucket: "face-references" | "event-photos", path: string) => Promise<Uint8Array | null>;
  engine: FaceEngine;
  log?: (line: string) => void;
  /** Teto de fotos por job (custo); o excedente fica para uma nova busca. */
  maxPhotos?: number;
  /** Prazo total do lote (ms) para não estourar o limite da função. */
  deadlineMs?: number;
  now?: () => number;
}
export interface JobOutcome { jobId: string; status: "completed" | "failed" | "queued" | "cancelled"; matches: number; processed: number; error?: string }

export const REFERENCE_RULES = { maxBytes: 5 * 1024 * 1024, minPx: 160, maxPx: 8192, maxPixels: 36_000_000 } as const;

export function checkReferenceBytes(b: Uint8Array): "invalid_image" | "low_quality" | null {
  if (b.length === 0 || b.length > REFERENCE_RULES.maxBytes) return "invalid_image";
  const s = sniffImage(b);
  if (!s) return "invalid_image";
  if (s.width > REFERENCE_RULES.maxPx || s.height > REFERENCE_RULES.maxPx || s.width * s.height > REFERENCE_RULES.maxPixels) return "invalid_image";
  if (Math.min(s.width, s.height) < REFERENCE_RULES.minPx) return "low_quality";
  return null;
}

async function call(deps: WorkerDeps, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await deps.rpc(fn, args);
  if (error) throw new Error(`rpc_${fn}_${error.code ?? "erro"}`);
  return data;
}

export async function processJob(deps: WorkerDeps, job: ClaimedJob): Promise<JobOutcome> {
  const log = deps.log ?? (() => {});
  const now = deps.now ?? Date.now;
  const started = now();
  const fail = async (error: string, referenceInvalid = false): Promise<JobOutcome> => {
    const st = (await call(deps, "smart_album_worker_fail", { p_job: job.jobId, p_error: error, p_reference_invalid: referenceInvalid })) as JobOutcome["status"];
    log(`smart-album job=${job.jobId} status=${st} erro=${error}`);
    return { jobId: job.jobId, status: st, matches: 0, processed: 0, error };
  };
  let ref: Uint8Array | null;
  try { ref = await deps.download("face-references", job.referencePath); } catch { return fail("reference_download"); }
  if (!ref) return fail("reference_missing", true);
  const bad = checkReferenceBytes(ref);
  if (bad) return fail(bad, true);
  let analyzed;
  try { analyzed = await deps.engine.analyzeReference(ref); } catch { return fail("engine_unavailable"); } finally { ref.fill(0); }
  if (!analyzed.ok) return fail(analyzed.error, true);
  const matches: { photoId: string; band: ConfidenceBand }[] = [];
  let processed = 0;
  try {
    const limit = Math.min(job.photoIds.length, deps.maxPhotos ?? 3000);
    for (let i = 0; i < limit; i++) {
      if (deps.deadlineMs !== undefined && now() - started > deps.deadlineMs) break;
      const id = job.photoIds[i];
      const bytes = await deps.download("event-photos", `${job.eventId}/${id}`);
      processed++;
      if (!bytes || !sniffImage(bytes)) continue; // foto sumiu/inválida: não é match
      const band = await deps.engine.compare(analyzed.handle, bytes);
      bytes.fill(0);
      if (band) matches.push({ photoId: id, band });
    }
  } catch {
    return fail("engine_error");
  } finally {
    deps.engine.dispose(analyzed.handle);
  }
  const n = (await call(deps, "smart_album_worker_complete", { p_job: job.jobId, p_matches: matches, p_processed: processed, p_engine: deps.engine.version })) as number;
  log(`smart-album job=${job.jobId} status=completed processadas=${processed} resultados=${n}`);
  return { jobId: job.jobId, status: "completed", matches: n, processed };
}

/**
 * Motor remoto (servidor próprio, ex.: Vertra): o worker não baixa bytes. Ele gera URLs assinadas curtas (só leitura, via service_role) da
 * referência e das fotos elegíveis e manda ao motor, que devolve só {id, band}. O motor não tem chave do banco e só baixa do host do Storage.
 */
export interface RemoteEngine {
  readonly version: string;
  search(referenceUrl: string, photos: { id: string; url: string }[]): Promise<{ reference: string; results: { id: string; band: ConfidenceBand }[]; processed: number }>;
}
export interface RemoteDeps extends Omit<WorkerDeps, "download" | "engine"> {
  remote: RemoteEngine;
  /** URLs assinadas (TTL curto) para caminhos de um bucket privado; caminho sem URL fica de fora. */
  sign: (bucket: "face-references" | "event-photos", paths: string[], ttlSeconds: number) => Promise<Record<string, string>>;
  chunk?: number;
}
const REFERENCE_ERRORS = new Set(["no_face", "multiple_faces", "low_quality", "invalid_image"]);

export async function processJobRemote(deps: RemoteDeps, job: ClaimedJob): Promise<JobOutcome> {
  const log = deps.log ?? (() => {});
  const now = deps.now ?? Date.now;
  const started = now();
  const fail = async (error: string, referenceInvalid = false): Promise<JobOutcome> => {
    const st = (await call(deps as unknown as WorkerDeps, "smart_album_worker_fail", { p_job: job.jobId, p_error: error, p_reference_invalid: referenceInvalid })) as JobOutcome["status"];
    log(`smart-album job=${job.jobId} status=${st} erro=${error}`);
    return { jobId: job.jobId, status: st, matches: 0, processed: 0, error };
  };
  let refUrl: string | undefined;
  try { refUrl = (await deps.sign("face-references", [job.referencePath], 300))[job.referencePath]; } catch { return fail("reference_download"); }
  if (!refUrl) return fail("reference_missing", true);
  const ids = job.photoIds.slice(0, deps.maxPhotos ?? 3000);
  const size = Math.max(1, Math.min(deps.chunk ?? 50, 60));
  const matches: { photoId: string; band: ConfidenceBand }[] = [];
  let processed = 0;
  for (let i = 0; i < ids.length; i += size) {
    if (deps.deadlineMs !== undefined && now() - started > deps.deadlineMs) break;
    const part = ids.slice(i, i + size);
    let urls: Record<string, string>;
    try { urls = await deps.sign("event-photos", part.map((id) => `${job.eventId}/${id}`), 300); } catch { return fail("sign_error"); }
    const photos = part.flatMap((id) => (urls[`${job.eventId}/${id}`] ? [{ id, url: urls[`${job.eventId}/${id}`] }] : []));
    if (!photos.length) { processed += part.length; continue; }
    let out;
    try { out = await deps.remote.search(refUrl, photos); } catch { return fail("engine_unavailable"); }
    if (out.reference !== "ok") return fail(REFERENCE_ERRORS.has(out.reference) ? out.reference : "engine_error", REFERENCE_ERRORS.has(out.reference));
    processed += part.length;
    const allowed = new Set(part);
    for (const r of out.results ?? []) if (allowed.has(r.id) && (r.band === "probable" || r.band === "review")) matches.push({ photoId: r.id, band: r.band });
  }
  const n = (await call(deps as unknown as WorkerDeps, "smart_album_worker_complete", { p_job: job.jobId, p_matches: matches, p_processed: processed, p_engine: deps.remote.version })) as number;
  log(`smart-album job=${job.jobId} status=completed processadas=${processed} resultados=${n}`);
  return { jobId: job.jobId, status: "completed", matches: n, processed };
}

/** Cliente HTTP do motor remoto. Bearer fixo; timeout por chamada; resposta validada (nunca aceita score/embedding). */
export function httpRemoteEngine(url: string, token: string, fetchFn: typeof fetch = fetch, timeoutMs = 110_000): RemoteEngine {
  const base = url.replace(/\/+$/, "");
  return {
    version: "opencv-yunet-sface.t1",
    async search(referenceUrl, photos) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await fetchFn(`${base}/v1/search`, { method: "POST", signal: ctl.signal, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ reference_url: referenceUrl, photos }) });
        if (!r.ok) throw new Error(`engine_${r.status}`);
        const b = (await r.json()) as { reference?: unknown; results?: unknown; processed?: unknown };
        const results = Array.isArray(b.results) ? (b.results as { id?: unknown; band?: unknown }[]).filter((x) => typeof x.id === "string" && (x.band === "probable" || x.band === "review")).map((x) => ({ id: x.id as string, band: x.band as ConfidenceBand })) : [];
        return { reference: typeof b.reference === "string" ? b.reference : "engine_error", results, processed: typeof b.processed === "number" ? b.processed : 0 };
      } finally {
        clearTimeout(t);
      }
    },
  };
}

export async function runBatch(deps: WorkerDeps | RemoteDeps, limit = 3): Promise<JobOutcome[]> {
  const jobs = ((await call(deps as WorkerDeps, "smart_album_worker_claim", { p_limit: limit })) as ClaimedJob[] | null) ?? [];
  const out: JobOutcome[] = [];
  const run = (j: ClaimedJob) => ("remote" in deps ? processJobRemote(deps, j) : processJob(deps, j));
  for (const j of jobs) {
    // sequencial (concorrência e custo limitados). Um job que falha (ex.: titular revogou no meio) não derruba os demais do lote;
    // ele volta à fila quando o lock vence ou já foi cancelado pelo banco.
    try {
      out.push(await run(j));
    } catch {
      (deps.log ?? (() => {}))(`smart-album job=${j.jobId} status=erro_lote`);
      out.push({ jobId: j.jobId, status: "cancelled", matches: 0, processed: 0, error: "batch_error" });
    }
  }
  return out;
}
