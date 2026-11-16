/**
 * Eventos de produto do Smart Album (seção 15 do plano). O repositório ainda não tem pipeline analítico no cliente: estes eventos saem como
 * `CustomEvent('mm:analytics')` na janela, prontos para um coletor futuro. Lista fechada de nomes e de propriedades: nada de imagem, nome,
 * e-mail, embedding, coordenada facial, URL ou id de usuário/foto. Propriedade fora da lista é descartada.
 */
export type SmartAlbumEventName =
  | "smart_album_viewed" | "smart_album_onboarding_started" | "smart_album_source_selected" | "smart_album_consent_granted"
  | "smart_album_consent_revoked" | "smart_album_job_started" | "smart_album_job_completed" | "smart_album_job_failed"
  | "smart_album_results_opened" | "smart_album_match_hidden" | "smart_album_reference_changed" | "smart_album_manual_favorite_added";

const ALLOWED: Record<string, (v: unknown) => boolean> = {
  source: (v) => v === "google" || v === "gallery" || v === "camera" || v === "skip",
  segment: (v) => v === "found" || v === "taken" || v === "favorites",
  step: (v) => v === "intro" || v === "source" || v === "review" || v === "consent",
  reason: (v) => typeof v === "string" && /^[a-z_-]{1,30}$/.test(v),
  count_bucket: (v) => v === "0" || v === "1-5" || v === "6-20" || v === "21+",
};

export function sanitize(props: Record<string, unknown> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) if (ALLOWED[k]?.(v)) out[k] = String(v);
  return out;
}

export const countBucket = (n: number): string => (n <= 0 ? "0" : n <= 5 ? "1-5" : n <= 20 ? "6-20" : "21+");

export function track(name: SmartAlbumEventName, props?: Record<string, unknown>, target: Pick<Window, "dispatchEvent"> | undefined = typeof window === "undefined" ? undefined : window): void {
  try {
    target?.dispatchEvent(new CustomEvent("mm:analytics", { detail: { name, props: sanitize(props) } }));
  } catch { /* coletor ausente: nada a fazer */ }
}
