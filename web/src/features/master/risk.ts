export type Severity = "crit" | "warn" | "info";
export type SignalCode = "ativo_sem_revelacao" | "ativo_sem_participante" | "limite_fora_catalogo" | "sem_anfitriao" | "revelacao_atrasada";
export interface RiskSignal { code: SignalCode; severity: Severity; label: string }
export interface RiskEvent {
  status: string;
  revealState?: string | null;
  revealAt?: string | null;
  participants: number;
  capacity?: number | null;
  hostName?: string | null;
  hostId?: string | null;
}
export interface Risk { score: number; signals: RiskSignal[] }

const WEIGHT: Record<Severity, number> = { crit: 40, warn: 15, info: 5 };
const SEM_REVELACAO = new Set(["desativada", "sem", "nenhuma"]);

/** Sinais de risco operacional de um evento; `now` em ms e `catalogCapacities` = capacidades vendidas no catálogo. */
export function eventRisk(ev: RiskEvent, now: number, catalogCapacities: readonly number[]): Risk {
  const signals: RiskSignal[] = [];
  const ativo = ev.status === "ativo";
  const at = ev.revealAt ? Date.parse(ev.revealAt) : NaN;
  const atrasada = ev.revealState === "atrasada" || (ev.revealState === "pendente" && Number.isFinite(at) && at < now);
  if (atrasada) signals.push({ code: "revelacao_atrasada", severity: "crit", label: "Revelação atrasada" });
  if (!ev.hostName?.trim() && !ev.hostId) signals.push({ code: "sem_anfitriao", severity: "crit", label: "Sem anfitrião" });
  if (ativo && (!ev.revealState || SEM_REVELACAO.has(ev.revealState)) && !ev.revealAt) signals.push({ code: "ativo_sem_revelacao", severity: "warn", label: "Ativo sem revelação programada" });
  if (ativo && ev.participants === 0) signals.push({ code: "ativo_sem_participante", severity: "warn", label: "Ativo sem participantes" });
  if (ev.capacity != null && !catalogCapacities.includes(ev.capacity)) signals.push({ code: "limite_fora_catalogo", severity: "info", label: `Limite de ${ev.capacity} fora do catálogo` });
  const score = Math.min(100, signals.reduce((s, x) => s + WEIGHT[x.severity], 0));
  return { score, signals };
}

/** Ordena do mais arriscado ao menos (estável); `riskOf` devolve o risco já calculado do item. */
export function sortByRisk<T>(items: readonly T[], riskOf: (item: T) => Risk): T[] {
  return items.map((it, i) => ({ it, i, s: riskOf(it).score })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.it);
}
