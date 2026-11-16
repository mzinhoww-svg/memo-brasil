/** Storage e saúde do Master (M27): jobs, medidores e barras de crescimento a partir de `admin_health`, `admin_health_history` e `admin_storage_breakdown`. */

/** "412 GB", "2,1 GB", "0,9 GB" (pt-BR, base 1024). */
export function bytes(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (v < 1024) return `${v} B`;
  const u = ["KB", "MB", "GB", "TB"]; let i = -1; let x = v;
  do { x /= 1024; i++; } while (x >= 1024 && i < u.length - 1);
  return `${x.toFixed(x < 10 ? 1 : 0).replace(".", ",")} ${u[i]}`;
}

export const JOB_LABEL: Record<string, string> = {
  "mm-reveal-due": "Revelar eventos na hora", "mm-payments-reconcile": "Conciliar pagamentos", "mm-expire-uploads": "Expirar uploads parados", "mm-expire-assets": "Expirar identidade visual",
  "mm-expire-retention": "Aplicar retenção", "mm-purge-deleted": "Limpar excluídos", "mm-purge-anon-orphans": "Limpar convidados órfãos", "mm-audit-integrity": "Integridade da auditoria",
};
export const jobLabel = (name: string): string => JOB_LABEL[name] ?? name.replace(/^mm-/, "").replace(/-/g, " ");

export interface JobRun { startedAt: string; durationMs: number | null; status: string }
export interface HistoryJob { name: string; schedule?: string; active: boolean; runs: JobRun[]; consecutiveFailures: number }
export interface JobRow { key: string; name: string; last: string | null; tone: "ok" | "bad" | "wait"; label: string; fails: number; dots: boolean[] }

/** As últimas N execuções, da mais antiga para a mais nova (a mais nova fica à direita); `true` = falhou. */
export const runDots = (runs: JobRun[], n = 8): boolean[] => runs.slice(0, n).map((r) => r.status !== "succeeded").reverse();

export function jobRows(jobs: HistoryJob[], when: (iso: string) => string, n = 8): JobRow[] {
  return jobs.map((j) => {
    const last = j.runs[0];
    const bad = !!last && last.status !== "succeeded";
    const dots = runDots(j.runs, n);
    while (dots.length < n) dots.unshift(false);
    return {
      key: j.name, name: jobLabel(j.name), last: last ? when(last.startedAt) : null,
      tone: !j.active ? "wait" : bad ? "bad" : "ok", label: !j.active ? "parado" : !last ? "sem leitura" : bad ? "falhou" : "ok", fails: j.consecutiveFailures, dots,
    };
  });
}

export interface StorageData {
  originals: { n: number; bytes: number }; derived: { n: number; bytes: number }; orphans: { n: number; bytes: number }; branding: { n: number; bytes: number };
  totalBytes: number; growth: { day: string; bytes: number }[]; uploads: { inProgress: number; failed24h: number; photosReady: number };
  quotaBytes: number | null; purgeQueue: { size: number; oldestAgeSeconds: number }; generatedAt?: string;
}
export interface GaugeRow { key: string; label: string; value: string; pct: number; warn?: boolean }
const nf = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const min1 = (n: number) => (n > 0 ? Math.max(1, Math.round(n)) : 0);

export function gaugeRows(s: StorageData): GaugeRow[] {
  const photosBytes = s.originals.bytes + s.derived.bytes;
  const photosN = s.originals.n;
  const q = s.quotaBytes && s.quotaBytes > 0 ? s.quotaBytes : null;
  const rows: GaugeRow[] = [
    { key: "fotos", label: `Fotos · ${nf(photosN)} arquivos`, value: q ? `${bytes(photosBytes)} de ${bytes(q)}` : bytes(photosBytes), pct: q ? clamp(min1((photosBytes / q) * 100)) : 0 },
    { key: "identidade", label: `Identidade visual · ${nf(s.branding.n)} arquivos`, value: bytes(s.branding.bytes), pct: clamp(min1(q ? (s.branding.bytes / q) * 100 : s.totalBytes ? (s.branding.bytes / s.totalBytes) * 100 : 0)) },
    { key: "andamento", label: "Uploads em andamento", value: nf(s.uploads.inProgress), pct: clamp(min1((s.uploads.inProgress / 200) * 100)) },
    { key: "falha", label: "Uploads com falha (24 h)", value: nf(s.uploads.failed24h), pct: clamp(min1((s.uploads.failed24h / 200) * 100)), warn: s.uploads.failed24h > 0 },
    { key: "orfaos", label: "Órfãos", value: `${nf(s.orphans.n)} ${s.orphans.n === 1 ? "arquivo" : "arquivos"} · ${bytes(s.orphans.bytes)}`, pct: clamp(min1((s.orphans.n / 10000) * 100)), warn: s.orphans.n > 0 },
  ];
  if (s.purgeQueue.size > 0) rows.push({ key: "fila", label: "Fila de exclusão", value: `${nf(s.purgeQueue.size)} ${s.purgeQueue.size === 1 ? "item" : "itens"}`, pct: clamp(min1(s.purgeQueue.size)), warn: s.purgeQueue.oldestAgeSeconds > 7200 });
  return rows;
}

export interface Bar { height: number; label: string; on: boolean }
/** Crescimento por dia: altura relativa ao maior dia; o dia mais recente fica em destaque; rótulo (dia do mês) a cada 5 barras. */
export function growthBars(growth: { day: string; bytes: number }[]): Bar[] {
  const max = Math.max(0, ...growth.map((g) => g.bytes));
  return growth.map((g, i) => ({ height: max > 0 ? (g.bytes > 0 ? Math.max(2, Math.round((g.bytes / max) * 100)) : 0) : 0, label: i % 5 === 4 ? String(Number(g.day.slice(8, 10))) : "", on: i === growth.length - 1 }));
}
export const growthTotal = (growth: { bytes: number }[]): string => `+${bytes(growth.reduce((n, g) => n + g.bytes, 0))}`;
