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

export async function runBatch(deps: WorkerDeps, limit = 3): Promise<JobOutcome[]> {
  const jobs = ((await call(deps, "smart_album_worker_claim", { p_limit: limit })) as ClaimedJob[] | null) ?? [];
  const out: JobOutcome[] = [];
  for (const j of jobs) out.push(await processJob(deps, j)); // sequencial: concorrência e custo limitados por execução
  return out;
}
