import type { SearchParams } from "@/features/master/params";

/**
 * Monta `path?query` a partir dos parâmetros atuais aplicando `patch`
 * (valor `null`/`undefined`/"" remove a chave). Qualquer mudança remove `p` (paginação), salvo se `p` estiver no patch.
 */
export function hrefWith(path: string, current: SearchParams, patch: Record<string, string | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) u.set(k, val);
  }
  if (!("p" in patch)) u.delete("p");
  for (const [k, v] of Object.entries(patch)) {
    if (v) u.set(k, v); else u.delete(k);
  }
  const q = u.toString();
  return q ? `${path}?${q}` : path;
}

export type SortDir = "asc" | "desc";
/** Lê `?ord=&dir=` aceitando só colunas conhecidas. */
export function parseSort(sp: SearchParams, allowed: readonly string[], fallback: { ord: string; dir: SortDir }): { ord: string; dir: SortDir } {
  const o = Array.isArray(sp.ord) ? sp.ord[0] : sp.ord;
  const d = Array.isArray(sp.dir) ? sp.dir[0] : sp.dir;
  if (!o || !allowed.includes(o)) return fallback;
  return { ord: o, dir: d === "asc" || d === "desc" ? d : fallback.dir };
}

/** Ordenação em memória (pt-BR, numérica quando ambos são números; nulos por último). */
export function sortRows<R extends object>(rows: readonly R[], ord: string, dir: SortDir): R[] {
  const get = (r: R) => (r as Record<string, unknown>)[ord];
  const sign = dir === "asc" ? 1 : -1;
  return rows.map((r, i) => ({ r, i })).sort((a, b) => {
    const x = get(a.r), y = get(b.r);
    if (x == null && y == null) return a.i - b.i;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
    return c * sign || a.i - b.i;
  }).map((x) => x.r);
}
