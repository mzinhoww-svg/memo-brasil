/** Apresentação das estatísticas de acesso (RPC admin_access_stats). Funções puras. */
export interface AccessStats {
  days: number;
  generatedAt: string;
  totals: { visitors: number; views: number; entries: number };
  series: { day: string; visitors: number; views: number }[];
  sources: { source: string; medium: string; entries: number; visitors: number }[];
  campaigns: { campaign: string; source: string; entries: number }[];
  referrers: { host: string; entries: number }[];
  pages: { path: string; views: number; visitors: number }[];
  devices: { device: string; visitors: number }[];
  browsers: { browser: string; visitors: number }[];
  countries: { country: string; visitors: number }[];
}

export const PERIODS = [1, 7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<Period, string> = { 1: "Hoje", 7: "7 dias", 30: "30 dias", 90: "90 dias" };
export const parsePeriod = (v: string | undefined): Period => { const n = Number(v); return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 7; };

/** "37%" (sem casas) de `part` sobre `total`; "—" quando não há total. */
export const share = (part: number, total: number): string => (total > 0 ? `${Math.round((part / total) * 100)}%` : "—");

/** Páginas por visita: visualizações ÷ visitantes do dia, com uma casa e vírgula. */
export const perVisit = (views: number, visitors: number): string => (visitors > 0 ? (views / visitors).toFixed(1).replace(".", ",") : "—");

export interface Bar { height: number; label: string; on: boolean; title: string }
/** Barras da série diária: altura proporcional ao maior dia; rótulo de 5 em 5 dias; o último dia (hoje) destacado. */
export function seriesBars(series: { day: string; visitors: number; views: number }[]): Bar[] {
  const max = Math.max(0, ...series.map((s) => s.visitors));
  const step = Math.max(1, Math.ceil(series.length / 8));
  return series.map((s, i) => ({
    height: max > 0 ? (s.visitors > 0 ? Math.max(3, Math.round((s.visitors / max) * 100)) : 0) : 0,
    label: (series.length - 1 - i) % step === 0 ? String(Number(s.day.slice(8, 10))) : "",
    on: i === series.length - 1,
    title: `${s.day.slice(8, 10)}/${s.day.slice(5, 7)}: ${s.visitors} visitantes · ${s.views} visualizações`,
  }));
}

const COUNTRY = new Intl.DisplayNames(["pt-BR"], { type: "region" });
/** Nome do país em português (BR → Brasil); "--" = não informado. */
export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "Não informado";
  try { return COUNTRY.of(code) ?? code; } catch { return code; }
}

export const MEDIUM_LABEL: Record<string, string> = { direto: "Direto", social: "Rede social", "orgânico": "Busca", "e-mail": "E-mail", "referência": "Outro site", pago: "Anúncio", campanha: "Campanha" };
export const mediumLabel = (m: string): string => MEDIUM_LABEL[m] ?? m;

/** Conversão por origem (RPC admin_conversion_by_origin): eventos criados no período pelo primeiro toque de quem criou. */
export type OriginConversionRow = { source: string; medium: string; campaign: string | null; events: number; activated: number; paid: number; revenueCents: number };
export type OriginConversion = { days: number; rows: OriginConversionRow[]; rowsLast?: OriginConversionRow[] };

/** Consulta semanal (RPC admin_conversion_weekly), por semana de criação do evento, a mais recente primeiro. */
export type WeeklyRow = { week: string; events: number; activated: number; hosts: number; hostsWhatsapp: number; atLimit: number;
  offersCreated: number; offersOpened: number; offersPaid: number; paid: number; orders: number; ordersExpired: number };
export type WeeklyConversion = { weeks: number; rows: WeeklyRow[] };
