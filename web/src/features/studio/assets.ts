import type { SupabaseClient } from "@supabase/supabase-js";

export type AssetKind = "logo" | "cover";
/** Limites espelhados em begin/finalize_asset e nas policies do bucket `event-branding`. SVG nunca: é vetor de XSS. */
export const ASSET_LIMITS = { logo: { bytes: 2 * 1024 * 1024 }, cover: { bytes: 5 * 1024 * 1024 }, mimes: ["image/png", "image/jpeg", "image/webp"], minPx: 16, maxPx: 8192 } as const;
export const ASSET_REASON = { tipo: "Use PNG, JPEG ou WebP.", tamanho: "Arquivo vazio ou acima do limite (logo 2 MB, capa 5 MB).", dimensoes: "A imagem precisa ter entre 16 e 8192 px de lado." } as const;

export type AssetCheck = { ok: true } | { ok: false; reason: keyof typeof ASSET_REASON };

export function validateAssetFile(kind: AssetKind, file: { type: string; size: number }, dim: { width: number; height: number }): AssetCheck {
  if (!(ASSET_LIMITS.mimes as readonly string[]).includes(file.type)) return { ok: false, reason: "tipo" };
  if (file.size <= 0 || file.size > ASSET_LIMITS[kind].bytes) return { ok: false, reason: "tamanho" };
  const { minPx, maxPx } = ASSET_LIMITS;
  if (![dim.width, dim.height].every((n) => Number.isInteger(n) && n >= minPx && n <= maxPx)) return { ok: false, reason: "dimensoes" };
  return { ok: true };
}

export interface BrandAsset { id: string; kind: AssetKind; storagePath: string }

/** Envio em duas fases (como as fotos): reserva a linha, sobe o objeto, confirma. Substitui o ativo anterior do mesmo tipo. */
export async function uploadBrandAsset(sb: SupabaseClient, eventId: string, kind: AssetKind, file: File, dim: { width: number; height: number }): Promise<BrandAsset> {
  const check = validateAssetFile(kind, file, dim);
  if (!check.ok) throw new Error(ASSET_REASON[check.reason]);
  const previous = await currentAsset(sb, eventId, kind);
  const id = crypto.randomUUID();
  const begun = await sb.rpc("begin_asset", { p_id: id, p_event: eventId, p_kind: kind, p_mime: file.type, p_width: dim.width, p_height: dim.height });
  if (begun.error) throw new Error(begun.error.message);
  const storagePath = (begun.data as { storagePath: string }).storagePath;
  const up = await sb.storage.from("event-branding").upload(storagePath, file, { contentType: file.type, upsert: false });
  if (up.error) { await sb.rpc("discard_asset", { p_id: id }); throw new Error(up.error.message); }
  const done = await sb.rpc("finalize_asset", { p_id: id });
  if (done.error) { await sb.storage.from("event-branding").remove([storagePath]); await sb.rpc("discard_asset", { p_id: id }); throw new Error(done.error.message); }
  if (previous) { await sb.rpc("discard_asset", { p_id: previous.id }); await sb.storage.from("event-branding").remove([previous.storagePath]); }
  return { id, kind, storagePath };
}

export async function currentAsset(sb: SupabaseClient, eventId: string, kind: AssetKind): Promise<BrandAsset | undefined> {
  const r = await sb.from("event_assets").select("id,kind,storage_path").eq("event_id", eventId).eq("kind", kind).eq("upload_status", "pronta").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return r.data ? { id: r.data.id as string, kind, storagePath: r.data.storage_path as string } : undefined;
}

/** URL assinada de curta duração: só host, membros e master conseguem (policy de leitura do bucket). */
export async function assetUrl(sb: SupabaseClient, a: BrandAsset, seconds = 3600): Promise<string | undefined> {
  const r = await sb.storage.from("event-branding").createSignedUrl(a.storagePath, seconds);
  return r.data?.signedUrl;
}
