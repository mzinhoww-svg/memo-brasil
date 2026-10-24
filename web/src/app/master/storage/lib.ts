/** Transformações puras da página Storage (só leitura). */

/**
 * Cota do Storage no plano gratuito do Supabase: 1 GB por projeto (https://supabase.com/pricing).
 * Constante documentada: o painel não lê a cota real do provedor, então o uso é uma estimativa.
 * Se o plano mudar (Pro: 100 GB incluídos), ajuste aqui.
 */
export const QUOTA_BYTES = 1024 ** 3;
export const QUOTA_LABEL = "1 GB (plano gratuito do Supabase)";

export interface Part { n: number; bytes: number }
export interface Breakdown {
  classified: boolean;
  originals: Part; derived: Part; orphans: Part; branding: Part;
  /** Só no modo degradado: fotos sem classificação (original + derivado + órfão juntos). */
  unclassified: Part;
  totalBytes: number;
  avgPhotoBytes: number | null;
  /** Bytes novos por dia (últimos 30 dias locais); vazio no modo degradado. */
  growth: { day: string; bytes: number }[];
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const part = (v: unknown): Part => ({ n: n((v as Part | null)?.n), bytes: n((v as Part | null)?.bytes) });
const ZERO: Part = { n: 0, bytes: 0 };

/** `admin_storage_breakdown()` → forma da página. */
export function fromBreakdown(d: unknown): Breakdown {
  const x = (d ?? {}) as Record<string, unknown>;
  const originals = part(x.originals), derived = part(x.derived), orphans = part(x.orphans), branding = part(x.branding);
  const sum = originals.bytes + derived.bytes + orphans.bytes + branding.bytes;
  return {
    classified: true, originals, derived, orphans, branding, unclassified: ZERO,
    totalBytes: x.totalBytes != null ? n(x.totalBytes) : sum,
    avgPhotoBytes: originals.n > 0 ? n(x.avgPhotoBytes) : null,
    growth: Array.isArray(x.growth) ? x.growth.map((g: Record<string, unknown>) => ({ day: String(g.day ?? "").slice(0, 10), bytes: n(g.bytes) })) : [],
  };
}

/** `admin_dashboard_metrics()` (antiga) → mesma forma, com as fotos "sem classificação". */
export function fromLegacyMetrics(d: unknown): Breakdown {
  const x = (d ?? {}) as { storage?: Record<string, unknown>; photos?: Record<string, unknown> };
  const st = x.storage ?? {};
  const photos = { n: n(st.photosObjects), bytes: n(st.photosBytes) };
  const branding = { n: n(st.brandingObjects), bytes: n(st.brandingBytes) };
  const ready = n(x.photos?.total);
  return {
    classified: false, originals: ZERO, derived: ZERO, orphans: ZERO, branding, unclassified: photos,
    totalBytes: photos.bytes + branding.bytes,
    // Sem a classificação, a média inclui miniaturas e órfãos divididos pelas fotos prontas: estimativa por cima.
    avgPhotoBytes: ready > 0 ? Math.round(photos.bytes / ready) : null,
    growth: [],
  };
}

/** Curva de ocupação: total de hoje menos o que entrou depois de cada dia. */
export function cumulativeGrowth(growth: readonly { day: string; bytes: number }[], totalBytes: number): { day: string; bytes: number }[] {
  const sorted = [...growth].sort((a, b) => a.day.localeCompare(b.day));
  const added = sorted.reduce((s, g) => s + g.bytes, 0);
  let acc = Math.max(0, totalBytes - added);
  return sorted.map((g) => ({ day: g.day, bytes: (acc += g.bytes) }));
}

/** Dias até atingir a cota no ritmo médio dos dias informados; null sem crescimento. */
export function daysToQuota(growth: readonly { bytes: number }[], totalBytes: number, quota = QUOTA_BYTES): number | null {
  if (totalBytes >= quota) return 0;
  const added = growth.reduce((s, g) => s + g.bytes, 0);
  if (!growth.length || added <= 0) return null;
  return Math.ceil((quota - totalBytes) / (added / growth.length));
}

/** Segmentos para a barra empilhada e a tabela. */
export function segments(b: Breakdown): { key: string; label: string; n: number; bytes: number; note: string }[] {
  const rows = b.classified
    ? [
        { key: "original", label: "Original", ...b.originals, note: "Arquivo enviado pelo convidado." },
        { key: "derivado", label: "Derivado", ...b.derived, note: "Miniatura gerada a partir do original." },
        { key: "orfao", label: "Órfão", ...b.orphans, note: "Arquivo sem foto correspondente no banco." },
        { key: "identidade", label: "Identidade", ...b.branding, note: "Capas e marcas dos eventos." },
      ]
    : [
        { key: "sem-classificacao", label: "Fotos (sem classificação)", ...b.unclassified, note: "Originais, miniaturas e órfãos juntos até a atualização do banco." },
        { key: "identidade", label: "Identidade", ...b.branding, note: "Capas e marcas dos eventos." },
      ];
  return rows;
}
