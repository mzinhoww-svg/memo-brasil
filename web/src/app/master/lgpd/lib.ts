export interface LgpdItem { userId: string; requestedAt: string; processedAt: string | null; status: string; daysOpen: number | null; overdue: boolean }
export type SlaTone = "ok" | "warn" | "crit";
export interface Sla { used: number; max: number; tone: SlaTone; late: boolean; done: boolean }

const DAY = 86_400_000;
/**
 * Dias usados do prazo. Pendente: `daysOpen` do servidor; processado: dias entre pedido e conclusão.
 * Tom: crit ao estourar (ou `overdue`), warn a partir de 80% do prazo, ok antes disso. Processado fora do prazo = crit.
 */
export function slaOf(i: LgpdItem, slaDays: number): Sla {
  const done = i.processedAt != null;
  const used = done
    ? Math.max(0, Math.floor((Date.parse(i.processedAt!) - Date.parse(i.requestedAt)) / DAY))
    : Math.max(0, i.daysOpen ?? 0);
  const late = done ? used > slaDays : i.overdue || used > slaDays;
  const tone: SlaTone = late ? "crit" : !done && used >= Math.ceil(slaDays * 0.8) ? "warn" : "ok";
  return { used, max: slaDays, tone, late, done };
}

/** Atrasadas primeiro, depois pendentes por mais dias usados, por fim processadas (mais recentes antes). */
export function sortBySla(items: readonly LgpdItem[], slaDays: number): LgpdItem[] {
  const rank = (i: LgpdItem) => (i.processedAt ? 2 : slaOf(i, slaDays).late ? 0 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? Date.parse(b.requestedAt) - Date.parse(a.requestedAt) : slaOf(b, slaDays).used - slaOf(a, slaDays).used));
}

const TZ = "America/Cuiaba";
export function monthKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}`;
}
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthLabel = (key: string) => `${MESES[Number(key.slice(5, 7)) - 1] ?? key}/${key.slice(2, 4)}`;

export interface MonthRow { month: string; label: string; requested: number; processed: number; late: number }
/** Pedidos por mês do pedido; concluídos por mês da conclusão; atrasadas pelo mês do pedido. Ordem cronológica, com meses vazios no intervalo. */
export function monthlyHistory(items: readonly LgpdItem[], slaDays: number): MonthRow[] {
  const m = new Map<string, MonthRow>();
  const row = (k: string) => {
    let r = m.get(k);
    if (!r) { r = { month: k, label: monthLabel(k), requested: 0, processed: 0, late: 0 }; m.set(k, r); }
    return r;
  };
  for (const i of items) {
    const r = row(monthKey(i.requestedAt)); r.requested++;
    if (slaOf(i, slaDays).late) r.late++;
    if (i.processedAt) row(monthKey(i.processedAt)).processed++;
  }
  const keys = [...m.keys()].sort();
  if (!keys.length) return [];
  const out: MonthRow[] = [];
  let [y, mo] = keys[0].split("-").map(Number);
  const [ey, emo] = keys[keys.length - 1].split("-").map(Number);
  while (y < ey || (y === ey && mo <= emo)) {
    const k = `${y}-${String(mo).padStart(2, "0")}`;
    out.push(m.get(k) ?? { month: k, label: monthLabel(k), requested: 0, processed: 0, late: 0 });
    if (++mo > 12) { mo = 1; y++; }
  }
  return out;
}
