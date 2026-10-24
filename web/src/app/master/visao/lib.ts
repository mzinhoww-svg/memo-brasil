/** Transformações puras da Visão geral. */
import { eventRisk, sortByRisk, type Risk } from "@/features/master/risk";
import type { EventRow } from "../eventos/lib";

export interface KpiData { value: number | null; previous: number | null; spark: number[] }
export interface Overview {
  days: number;
  kpis: { activeEvents: KpiData; participants: KpiData; photos: KpiData; revenueCents: KpiData };
  series: { day: string; photos: number; joins: number; eventsCreated: number }[];
  funnel: { created: number; withParticipant: number; withPhoto: number; revealed: number } | null;
  upcomingReveals: { eventId: string; title: string; revealAt: string; isTest: boolean }[];
  storage: { originals: number; derived: number; orphans: number; bytes: number } | null;
  jobs: { name: string; ok: boolean }[];
  readiness: { companyCnpj: boolean; companyLegalName: boolean; supportEmail: boolean; supportPhone: boolean; paymentsEnv: string; lastWebhookAt: string | null } | null;
}

const kpi = (v: unknown): KpiData => {
  const k = (v ?? {}) as Partial<KpiData>;
  return { value: typeof k.value === "number" ? k.value : null, previous: typeof k.previous === "number" ? k.previous : null, spark: Array.isArray(k.spark) ? k.spark.map(Number) : [] };
};
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Normaliza o retorno de `admin_overview` (campos ausentes não quebram a página). */
export function toOverview(data: unknown): Overview {
  const d = (data ?? {}) as Record<string, unknown>;
  const k = (d.kpis ?? {}) as Record<string, unknown>;
  return {
    days: Number(d.days) || 30,
    kpis: { activeEvents: kpi(k.activeEvents), participants: kpi(k.participants), photos: kpi(k.photos), revenueCents: kpi(k.revenueCents) },
    series: arr(d.series),
    funnel: (d.funnel as Overview["funnel"]) ?? null,
    upcomingReveals: arr(d.upcomingReveals),
    storage: (d.storage as Overview["storage"]) ?? null,
    jobs: arr(d.jobs),
    readiness: (d.readiness as Overview["readiness"]) ?? null,
  };
}

interface LegacyMetrics { events?: { active?: number }; participants?: { joined?: number }; photos?: { uploaded?: number } }
/**
 * Sem `admin_overview`: os três números do console atual (`admin_dashboard_metrics`, testes incluídos).
 * Sem anterior, sparkline, receita, série, funil, storage, rotinas nem prontidão.
 */
export function overviewFromLegacy(data: unknown, days: number): Overview {
  const m = (data ?? {}) as LegacyMetrics;
  const one = (v: number | undefined): KpiData => ({ value: typeof v === "number" ? v : null, previous: null, spark: [] });
  return {
    days,
    kpis: { activeEvents: one(m.events?.active), participants: one(m.participants?.joined), photos: one(m.photos?.uploaded), revenueCents: { value: null, previous: null, spark: [] } },
    series: [], funnel: null, upcomingReveals: [], storage: null, jobs: [], readiness: null,
  };
}

/** Série diária para o gráfico (rótulo dd/mm a partir de `YYYY-MM-DD`). */
export function chartData(series: Overview["series"]) {
  return series.map((p) => {
    const [, mm, dd] = String(p.day).split("-");
    return { label: dd && mm ? `${dd}/${mm}` : String(p.day), a: Number(p.photos) || 0, b: Number(p.joins) || 0, line: Number(p.eventsCreated) || 0 };
  });
}

export interface ReadinessItem { key: string; label: string; ok: boolean }
/** Checklist "Pronto para produção"; a página esconde o card quando todos estão ok. */
export function readinessItems(r: Overview["readiness"]): ReadinessItem[] {
  if (!r) return [];
  return [
    { key: "cnpj", label: "CNPJ da empresa", ok: r.companyCnpj === true },
    { key: "razao", label: "Razão social", ok: r.companyLegalName === true },
    { key: "email", label: "E-mail de suporte", ok: r.supportEmail === true },
    { key: "telefone", label: "Telefone de suporte", ok: r.supportPhone === true },
    { key: "pagamentos", label: "Pagamentos em produção", ok: r.paymentsEnv === "production" },
    { key: "webhook", label: "Webhook com último evento recebido", ok: !!r.lastWebhookAt },
  ];
}

export interface AttentionRow { row: EventRow; risk: Risk }
/** Eventos com algum sinal de risco, do mais arriscado ao menos (até `limit`). Excluídos ficam de fora. */
export function attention(rows: readonly EventRow[], now: number, caps: readonly number[], limit = 10): AttentionRow[] {
  const scored = rows.filter((r) => !r.deletedAt && r.status !== "excluido").map((row) => ({ row, risk: eventRisk(row, now, caps) })).filter((x) => x.risk.score > 0);
  return sortByRisk(scored, (x) => x.risk).slice(0, limit);
}
