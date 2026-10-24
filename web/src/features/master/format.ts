export const num = (n: number | null | undefined) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
export const brl = (cents: number | null | undefined) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents ?? 0) / 100);

export function bytes(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (v < 1024) return `${v} B`;
  const u = ["KB", "MB", "GB", "TB"]; let i = -1; let x = v;
  do { x /= 1024; i++; } while (x >= 1024 && i < u.length - 1);
  return `${x.toFixed(x < 10 ? 1 : 0).replace(".", ",")} ${u[i]}`;
}

/** Percentual de `part` sobre `total`; "—" quando o total é zero. */
export function pct(part: number | null | undefined, total: number | null | undefined, digits = 0): string {
  if (!total) return "—";
  return `${(((part ?? 0) / total) * 100).toFixed(digits).replace(".", ",")}%`;
}

/** Contagem regressiva legível: "em 1 dia e 11 h", "em 25 min", "há 2 h e 5 min", "agora". */
export function countdown(target: number | string | Date, now: number): string {
  const t = target instanceof Date ? target.getTime() : typeof target === "string" ? Date.parse(target) : target;
  if (!Number.isFinite(t)) return "—";
  const diff = t - now;
  const mins = Math.floor(Math.abs(diff) / 60_000);
  if (mins < 1) return "agora";
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  let txt: string;
  if (d > 0) txt = `${d} ${d === 1 ? "dia" : "dias"}${h > 0 ? ` e ${h} h` : ""}`;
  else if (h > 0) txt = `${h} h${m > 0 ? ` e ${m} min` : ""}`;
  else txt = `${m} min`;
  return diff > 0 ? `em ${txt}` : `há ${txt}`;
}
