/** Linha do tempo pura das revelações. */
import type { EventRow } from "../eventos/lib";

export interface RevealItem { row: EventRow; at: number; overdue: boolean }
export interface RevealTimeline { overdue: RevealItem[]; upcoming: RevealItem[] }

/**
 * Só revelações ainda não executadas (pendente/atrasada) e com horário. Atrasadas primeiro (a mais antiga no topo),
 * depois as próximas (a mais próxima no topo). Atraso = estado `atrasada` ou horário já passado.
 */
export function revealTimeline(rows: readonly EventRow[], now: number): RevealTimeline {
  const items = rows
    .filter((r) => !r.deletedAt && (r.revealState === "pendente" || r.revealState === "atrasada") && r.revealAt)
    .map((row) => { const at = Date.parse(row.revealAt as string); return { row, at, overdue: row.revealState === "atrasada" || at <= now }; })
    .filter((x) => Number.isFinite(x.at))
    .sort((a, b) => a.at - b.at);
  return { overdue: items.filter((x) => x.overdue), upcoming: items.filter((x) => !x.overdue) };
}

/** Agrupa por dia local (America/Cuiaba) preservando a ordem. */
export function byDay(items: readonly RevealItem[]): { day: string; items: RevealItem[] }[] {
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Cuiaba", weekday: "short", day: "2-digit", month: "2-digit" });
  const out: { day: string; items: RevealItem[] }[] = [];
  for (const it of items) {
    const day = fmt.format(it.at);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(it); else out.push({ day, items: [it] });
  }
  return out;
}
